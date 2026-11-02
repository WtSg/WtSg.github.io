/*
 * Gallery Studio: keeping HDR.
 *
 * An HDR photo from an iPhone (HEIC), or a JPEG from Android, Lightroom or
 * Photoshop, is a normal (SDR) picture plus a gain map: a small greyscale image
 * that says how much brighter each part of the picture may go on an HDR screen.
 * The studio resizes the picture as before, resizes the gain map with it, and
 * writes one JPEG that carries both (an "Ultra HDR" JPEG: the gain map is a
 * second image indexed by Multi-Picture Format, described in ISO 21496-1 and in
 * Adobe's hdrgm XMP). HDR screens in Chrome, Edge and Safari show it in HDR;
 * everything else shows the normal picture.
 *
 * Reads:
 *   - HEIC/HEIF: an ISO 21496-1 'tmap' gain map, or Apple's HDR gain map (an
 *     auxiliary image, urn:com:apple:photo:2020:aux:hdrgainmap). The gain map's
 *     HEVC tiles are decoded with WebCodecs (Safari; Chrome where the system
 *     decodes HEVC).
 *   - JPEG with an MPF gain map: ISO 21496-1, Adobe hdrgm, or Apple's.
 * Apple's gain map means: HDR = SDR x (1 + (headroom - 1) x linear(g)). It is
 * rewritten exactly into the ISO form (log2 gain, gamma 1) pixel by pixel.
 *
 * Exposes window.StudioHDR = { read, join, decodeHeif }.
 */
(function () {
  "use strict";

  var ISO_NS = "urn:iso:std:iso:ts:21496:-1";
  var XMP_NS = "http://ns.adobe.com/xap/1.0/";
  var HDRGM = "http://ns.adobe.com/hdr-gain-map/1.0/";
  var APPLE_GM = "http://ns.apple.com/HDRGainMap/1.0/";

  function fail(why) { var e = new Error(why); e.hdr = true; return e; }
  function latin1(u8, a, b) { var s = ""; for (var i = a; i < b; i++) s += String.fromCharCode(u8[i]); return s; }
  function utf8(u8) { return new TextDecoder("utf-8").decode(u8); }
  function concat(parts) {
    var n = 0, k;
    for (k = 0; k < parts.length; k++) n += parts[k].length;
    var out = new Uint8Array(n), p = 0;
    for (k = 0; k < parts.length; k++) { out.set(parts[k], p); p += parts[k].length; }
    return out;
  }
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  /* ================= HEIF (HEIC) container ================= */
  function fourcc(v, p) { return String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3)); }
  function readN(v, p, n) {
    if (n === 0) return 0;
    if (n === 1) return v.getUint8(p);
    if (n === 2) return v.getUint16(p);
    if (n === 4) return v.getUint32(p);
    if (n === 8) return v.getUint32(p) * 4294967296 + v.getUint32(p + 4);
    throw fail("field size " + n);
  }
  function boxes(v, start, end) {
    var out = [], p = start;
    while (p + 8 <= end) {
      var size = v.getUint32(p), type = fourcc(v, p + 4), head = 8;
      if (size === 1) { size = readN(v, p + 8, 8); head = 16; }
      else if (size === 0) size = end - p;
      if (size < head || p + size > end) break;
      out.push({ type: type, start: p, data: p + head, end: p + size });
      p += size;
    }
    return out;
  }
  function first(list, type) { for (var i = 0; i < list.length; i++) if (list[i].type === type) return list[i]; return null; }
  function cstr(u8, p, end) { var q = p; while (q < end && u8[q] !== 0) q++; return { s: latin1(u8, p, q), next: q + 1 }; }

  function parseHeif(buf) {
    var v = new DataView(buf), u8 = new Uint8Array(buf);
    var top = boxes(v, 0, buf.byteLength);
    var ftyp = first(top, "ftyp"), meta = first(top, "meta");
    if (!ftyp || !meta) return null;
    var mb = boxes(v, meta.data + 4, meta.end);
    var h = { v: v, u8: u8, items: {}, refs: [], props: [], primary: 0, idat: null };
    var pitm = first(mb, "pitm");
    if (pitm) h.primary = u8[pitm.data] === 0 ? v.getUint16(pitm.data + 4) : v.getUint32(pitm.data + 4);
    var iinf = first(mb, "iinf");
    if (iinf) {
      var iv = u8[iinf.data], q = iinf.data + 4 + (iv === 0 ? 2 : 4);
      boxes(v, q, iinf.end).forEach(function (b) {
        if (b.type !== "infe") return;
        var ver = u8[b.data];
        if (ver < 2) return;
        var r = b.data + 4, id = ver === 2 ? v.getUint16(r) : v.getUint32(r);
        r += (ver === 2 ? 2 : 4) + 2;
        var type = fourcc(v, r), name = cstr(u8, r + 4, b.end), ct = "";
        if (type === "mime") ct = cstr(u8, name.next, b.end).s;
        h.items[id] = { id: id, type: type, contentType: ct, props: [], extents: [], method: 0 };
      });
    }
    var iloc = first(mb, "iloc");
    if (iloc) {
      var lv = u8[iloc.data], p = iloc.data + 4;
      var offSize = u8[p] >> 4, lenSize = u8[p] & 15, baseSize = u8[p + 1] >> 4, idxSize = (lv === 1 || lv === 2) ? u8[p + 1] & 15 : 0;
      p += 2;
      var count = lv < 2 ? v.getUint16(p) : v.getUint32(p);
      p += lv < 2 ? 2 : 4;
      for (var k = 0; k < count; k++) {
        var itemId = lv < 2 ? v.getUint16(p) : v.getUint32(p);
        p += lv < 2 ? 2 : 4;
        var method = 0;
        if (lv === 1 || lv === 2) { method = v.getUint16(p) & 15; p += 2; }
        p += 2;
        var base = readN(v, p, baseSize);
        p += baseSize;
        var ec = v.getUint16(p);
        p += 2;
        var ext = [];
        for (var e = 0; e < ec; e++) {
          p += idxSize;
          var off = readN(v, p, offSize);
          p += offSize;
          var len = readN(v, p, lenSize);
          p += lenSize;
          ext.push([base + off, len]);
        }
        if (h.items[itemId]) { h.items[itemId].extents = ext; h.items[itemId].method = method; }
      }
    }
    var iref = first(mb, "iref");
    if (iref) {
      var idSize = u8[iref.data] === 0 ? 2 : 4;
      boxes(v, iref.data + 4, iref.end).forEach(function (b) {
        var r = b.data, from = readN(v, r, idSize), to = [];
        r += idSize;
        var c = v.getUint16(r);
        r += 2;
        for (var j = 0; j < c; j++) { to.push(readN(v, r, idSize)); r += idSize; }
        h.refs.push({ type: b.type, from: from, to: to });
      });
    }
    var iprp = first(mb, "iprp");
    if (iprp) {
      var ib = boxes(v, iprp.data, iprp.end), ipco = first(ib, "ipco");
      if (ipco) h.props = boxes(v, ipco.data, ipco.end);
      ib.forEach(function (ipma) {
        if (ipma.type !== "ipma") return;
        var ver = u8[ipma.data], flags = u8[ipma.data + 3], r = ipma.data + 4, n = v.getUint32(r);
        r += 4;
        for (var j = 0; j < n; j++) {
          var id = ver < 1 ? v.getUint16(r) : v.getUint32(r);
          r += ver < 1 ? 2 : 4;
          var c = u8[r++];
          for (var a = 0; a < c; a++) {
            var idx;
            if (flags & 1) { idx = v.getUint16(r) & 0x7fff; r += 2; } else { idx = u8[r] & 0x7f; r += 1; }
            if (h.items[id] && idx > 0 && h.props[idx - 1]) h.items[id].props.push(h.props[idx - 1]);
          }
        }
      });
    }
    var idat = first(mb, "idat");
    if (idat) h.idat = [idat.data, idat.end];
    return h;
  }
  function itemData(h, item) {
    if (!item) throw fail("missing item");
    if (item.method === 2) throw fail("item offsets");
    var parts = item.extents.map(function (e) {
      var base = item.method === 1 ? (h.idat ? h.idat[0] : 0) : 0, start = base + e[0];
      var end = e[1] ? start + e[1] : (item.method === 1 && h.idat ? h.idat[1] : h.u8.length);
      if (start < 0 || end > h.u8.length) throw fail("item outside the file");
      return h.u8.subarray(start, end);
    });
    return parts.length === 1 ? parts[0] : concat(parts);
  }
  function prop(item, type) { for (var i = 0; i < item.props.length; i++) if (item.props[i].type === type) return item.props[i]; return null; }
  function refsFrom(h, type, from) { for (var i = 0; i < h.refs.length; i++) if (h.refs[i].type === type && h.refs[i].from === from) return h.refs[i].to; return []; }
  function size(h, item) {
    var p = prop(item, "ispe");
    return p ? { w: h.v.getUint32(p.data + 4), h: h.v.getUint32(p.data + 8) } : null;
  }
  // Rotation (anticlockwise quarter turns) and mirroring, in the order the file lists them.
  function transforms(h, item) {
    var ops = [];
    item.props.forEach(function (p) {
      if (p.type === "irot") ops.push(["rot", h.u8[p.data] & 3]);
      else if (p.type === "imir") ops.push(["mir", h.u8[p.data] & 1]);
    });
    return ops;
  }
  function nclx(h, item) {
    var p = prop(item, "colr");
    if (!p || fourcc(h.v, p.data) !== "nclx") return null;
    return { primaries: h.v.getUint16(p.data + 4), transfer: h.v.getUint16(p.data + 6), matrix: h.v.getUint16(p.data + 8), full: (h.u8[p.data + 10] & 0x80) !== 0 };
  }
  function grid(h, item) {
    var d = itemData(h, item), dv = new DataView(d.buffer, d.byteOffset, d.length), big = d[1] & 1;
    return {
      rows: d[2] + 1, cols: d[3] + 1,
      w: big ? dv.getUint32(4) : dv.getUint16(4), h: big ? dv.getUint32(8) : dv.getUint16(6),
      tiles: refsFrom(h, "dimg", item.id)
    };
  }

  /* ================= ISO 21496-1 metadata ================= */
  // Parses the metadata block (without the leading version byte of a 'tmap' item).
  function parseIso(u8) {
    if (u8.length < 4) return null;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    if (dv.getUint16(0) !== 0) return null;                       // minimum_version we understand: 0
    if (u8.length === 4) return { versionOnly: true };
    var flags = u8[4], channels = flags & 0x80 ? 3 : 1, common = flags & 0x08, p = 5;
    if (flags & 0x04) return null;                                 // base image is the HDR one: not handled
    var u32 = function () { var x = dv.getUint32(p); p += 4; return x; };
    var s32 = function () { var x = dv.getInt32(p); p += 4; return x; };
    var m = { channels: channels, useBase: (flags & 0x40) !== 0, min: [], max: [], gamma: [], baseOffset: [], altOffset: [] };
    try {
      if (common) {
        var d = u32();
        if (!d) return null;
        m.baseHeadroom = u32() / d;
        m.altHeadroom = u32() / d;
        for (var c = 0; c < channels; c++) {
          m.min.push(s32() / d); m.max.push(s32() / d); m.gamma.push(u32() / d);
          m.baseOffset.push(s32() / d); m.altOffset.push(s32() / d);
        }
      } else {
        var frac = function (signed) { var n = signed ? s32() : u32(), dd = u32(); if (!dd) throw fail("zero denominator"); return n / dd; };
        m.baseHeadroom = frac(false);
        m.altHeadroom = frac(false);
        for (var k = 0; k < channels; k++) {
          m.min.push(frac(true)); m.max.push(frac(true)); m.gamma.push(frac(false));
          m.baseOffset.push(frac(true)); m.altOffset.push(frac(true));
        }
      }
    } catch (e) { return null; }
    return valid(m) ? m : null;
  }
  function valid(m) {
    if (!(m.altHeadroom > m.baseHeadroom) || m.baseHeadroom < 0) return false;
    for (var c = 0; c < m.channels; c++) {
      if (!(m.max[c] >= m.min[c]) || !(m.gamma[c] > 0) || m.baseOffset[c] < 0 || m.altOffset[c] < 0) return false;
    }
    return true;
  }
  // Writes the metadata as ISO 21496-1 lays it out in a JPEG APP2: minimum and writer
  // version (both 0), flags, then independent fractions (the common-denominator form is
  // reserved in the published standard).
  function encodeIso(m) {
    var D = 1000000, n = m.channels, out = new Uint8Array(5 + 16 + n * 40), dv = new DataView(out.buffer), p = 5;
    out[4] = (n === 3 ? 0x80 : 0) | (m.useBase ? 0x40 : 0);
    var u = function (x) { dv.setUint32(p, Math.max(0, Math.round(x * D))); dv.setUint32(p + 4, D); p += 8; };
    var s = function (x) { dv.setInt32(p, Math.round(x * D)); dv.setUint32(p + 4, D); p += 8; };
    u(m.baseHeadroom); u(m.altHeadroom);
    for (var c = 0; c < n; c++) { s(m.min[c]); s(m.max[c]); u(m.gamma[c]); s(m.baseOffset[c]); s(m.altOffset[c]); }
    return out;
  }
  // Apple's gain map, rewritten as an ISO one: gain 1 .. headroom, log2-encoded, gamma 1.
  function appleMeta(headroom) {
    var L = Math.log2(headroom);
    return { channels: 1, useBase: true, min: [0], max: [L], gamma: [1], baseOffset: [0], altOffset: [0], baseHeadroom: 0, altHeadroom: L };
  }
  // r = log2(1 + (H - 1) * linear(g)) / log2(H), as a 256-entry table.
  function appleTable(headroom) {
    var t = new Uint8Array(256), L = Math.log2(headroom);
    for (var i = 0; i < 256; i++) {
      var g = i / 255, lin = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      t[i] = Math.round(255 * Math.log2(1 + (headroom - 1) * lin) / L);
    }
    return t;
  }
  // Apple's headroom from the camera's maker notes (tags 33 and 48), as Apple documents it.
  function appleHeadroomFromExif(tiff) {
    if (!tiff || tiff.length < 8) return 0;
    var dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.length), le = tiff[0] === 0x49;
    var u16 = function (p) { return dv.getUint16(p, le); }, u32 = function (p) { return dv.getUint32(p, le); };
    var findTag = function (ifd, tag) {
      if (ifd + 2 > tiff.length) return null;
      var n = u16(ifd);
      for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (e + 12 > tiff.length) return null; if (u16(e) === tag) return e; }
      return null;
    };
    try {
      var exifPtr = findTag(u32(4), 0x8769);
      if (exifPtr === null) return 0;
      var mn = findTag(u32(exifPtr + 8), 0x927c);
      if (mn === null) return 0;
      var start = u32(mn + 8);
      if (latin1(tiff, start, start + 9) !== "Apple iOS") return 0;
      // Apple's maker notes: a 14-byte header, then a big-endian IFD whose offsets count from the header.
      var ifd = start + 14, n = dv.getUint16(ifd), m33 = null, m48 = null;
      for (var i = 0; i < n; i++) {
        var e = ifd + 2 + i * 12, tag = dv.getUint16(e), type = dv.getUint16(e + 2);
        if ((tag === 33 || tag === 48) && (type === 10 || type === 5)) {
          var at = start + dv.getUint32(e + 8), num = type === 10 ? dv.getInt32(at) : dv.getUint32(at), den = dv.getUint32(at + 4);
          if (den) { if (tag === 33) m33 = num / den; else m48 = num / den; }
        }
      }
      if (m33 === null && m48 === null) return 0;
      m33 = m33 || 0; m48 = m48 || 0;
      var stops = m33 < 1 ? (m48 <= 0.01 ? -20 * m48 + 1.8 : -0.101 * m48 + 1.601) : (m48 <= 0.01 ? -70 * m48 + 3 : -0.303 * m48 + 2.303);
      return Math.pow(2, Math.max(stops, 0));
    } catch (e) { return 0; }
  }
  function tiffIn(u8) {
    for (var i = 0; i + 4 <= u8.length && i < 64; i++) {
      if ((u8[i] === 0x4D && u8[i + 1] === 0x4D && u8[i + 2] === 0 && u8[i + 3] === 0x2A) ||
          (u8[i] === 0x49 && u8[i + 1] === 0x49 && u8[i + 2] === 0x2A && u8[i + 3] === 0)) return u8.subarray(i);
    }
    return null;
  }
  function exifOrientation(tiff) {
    if (!tiff) return 1;
    try {
      var dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.length), le = tiff[0] === 0x49, ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le);
      for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (dv.getUint16(e, le) === 0x0112) return dv.getUint16(e + 8, le) || 1; }
    } catch (e) {}
    return 1;
  }

  /* ================= XMP ================= */
  function prefixFor(xml, uri) {
    var m = new RegExp("xmlns:([A-Za-z0-9_-]+)\\s*=\\s*[\"']" + uri.replace(/[.\/]/g, "\\$&") + "[\"']").exec(xml);
    return m ? m[1] : null;
  }
  function xmpNums(xml, pre, key) {
    var a = new RegExp(pre + ":" + key + "\\s*=\\s*[\"']([^\"']*)[\"']").exec(xml);
    if (a) return [parseFloat(a[1])];
    var e = new RegExp("<" + pre + ":" + key + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + pre + ":" + key + ">").exec(xml);
    if (!e) return null;
    var lis = e[1].match(/<rdf:li[^>]*>[^<]*<\/rdf:li>/g);
    if (lis) return lis.map(function (li) { return parseFloat(li.replace(/<[^>]+>/g, "")); });
    return [parseFloat(e[1])];
  }
  function xmpText(xml, pre, key) {
    var a = new RegExp(pre + ":" + key + "\\s*=\\s*[\"']([^\"']*)[\"']").exec(xml);
    if (a) return a[1];
    var e = new RegExp("<" + pre + ":" + key + "(?:\\s[^>]*)?>([^<]*)</" + pre + ":" + key + ">").exec(xml);
    return e ? e[1] : null;
  }
  function three(v, d) { v = v || [d]; return v.length >= 3 ? v.slice(0, 3) : [v[0], v[0], v[0]]; }
  // Adobe's hdrgm description (Lightroom, Photoshop, Android Ultra HDR).
  function hdrgmMeta(xml) {
    var pre = prefixFor(xml, HDRGM);
    if (!pre || !xmpText(xml, pre, "Version")) return null;
    if ((xmpText(xml, pre, "BaseRenditionIsHDR") || "False") === "True") return null;
    var min = three(xmpNums(xml, pre, "GainMapMin"), 0), max = three(xmpNums(xml, pre, "GainMapMax"), 1);
    var gamma = three(xmpNums(xml, pre, "Gamma"), 1), os = three(xmpNums(xml, pre, "OffsetSDR"), 1 / 64), oh = three(xmpNums(xml, pre, "OffsetHDR"), 1 / 64);
    var same = min[0] === min[1] && min[1] === min[2] && max[0] === max[1] && max[1] === max[2] && gamma[0] === gamma[1] && gamma[1] === gamma[2];
    var m = {
      channels: same ? 1 : 3, useBase: true, min: min, max: max, gamma: gamma, baseOffset: os, altOffset: oh,
      baseHeadroom: (xmpNums(xml, pre, "HDRCapacityMin") || [0])[0], altHeadroom: (xmpNums(xml, pre, "HDRCapacityMax") || [1])[0]
    };
    if (same) ["min", "max", "gamma", "baseOffset", "altOffset"].forEach(function (k) { m[k] = m[k].slice(0, 1); });
    return valid(m) ? m : null;
  }
  function appleXmp(xml) {
    var pre = prefixFor(xml, APPLE_GM);
    if (!pre && !/hdrgainmap/i.test(xml)) return null;
    var h = pre ? xmpNums(xml, pre, "HDRGainMapHeadroom") : null;
    return { headroom: h && h[0] > 1 ? h[0] : 0 };
  }

  /* ================= JPEG ================= */
  function segments(u8, start) {
    var out = [], p = start + 2;
    while (p + 4 <= u8.length && u8[p] === 0xFF) {
      var m = u8[p + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { p += 2; continue; }
      if (m === 0xDA || m === 0xD9) break;
      var len = (u8[p + 2] << 8) | u8[p + 3];
      out.push({ m: m, data: p + 4, end: p + 2 + len });
      p += 2 + len;
    }
    return out;
  }
  function startsWith(u8, p, s) { for (var i = 0; i < s.length; i++) if (u8[p + i] !== s.charCodeAt(i)) return false; return true; }
  function readJpeg(u8) {
    var segs = segments(u8, 0), exif = null, mpf = null;
    segs.forEach(function (s) {
      if (s.m === 0xE1 && startsWith(u8, s.data, "Exif\0\0") && !exif) exif = u8.subarray(s.data + 6, s.end);
      if (s.m === 0xE2 && startsWith(u8, s.data, "MPF\0") && !mpf) mpf = s;
    });
    if (!mpf) return null;
    var t = mpf.data + 4, le = u8[t] === 0x49, dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    var ifd = t + dv.getUint32(t + 4, le), n = dv.getUint16(ifd, le), entries = null, count = 0;
    for (var i = 0; i < n; i++) {
      var e = ifd + 2 + i * 12, tag = dv.getUint16(e, le);
      if (tag === 0xB002) { count = dv.getUint32(e + 4, le) / 16; entries = t + dv.getUint32(e + 8, le); }
    }
    if (!entries) return null;
    for (var k = 1; k < count; k++) {
      var at = entries + k * 16, len = dv.getUint32(at + 4, le), off = dv.getUint32(at + 8, le), abs = t + off;
      if (!off || abs + 4 > u8.length || u8[abs] !== 0xFF || u8[abs + 1] !== 0xD8) continue;
      var img = u8.subarray(abs, Math.min(u8.length, abs + (len || u8.length)));
      var meta = null, apple = null;
      segments(img, 0).forEach(function (s) {
        if (s.m === 0xE2 && startsWith(img, s.data, ISO_NS + "\0") && !meta) meta = parseIso(img.subarray(s.data + ISO_NS.length + 1, s.end));
        if (s.m === 0xE1 && startsWith(img, s.data, XMP_NS + "\0")) {
          var xml = utf8(img.subarray(s.data + XMP_NS.length + 1, s.end));
          if (!meta) meta = hdrgmMeta(xml);
          if (!apple) apple = appleXmp(xml);
        }
      });
      if (meta && meta.versionOnly) meta = null;
      var tiff = exif ? tiffIn(exif) : null;
      if (!meta && apple) {
        var H = apple.headroom || appleHeadroomFromExif(tiff);
        if (H > 1.01) return { image: img, meta: appleMeta(H), table: appleTable(H), orientation: exifOrientation(tiff) };
      }
      if (meta) return { image: img, meta: meta, table: null, orientation: exifOrientation(tiff) };
    }
    return null;
  }

  /* ================= Pixels: decoding tiles, orienting, converting ================= */
  function hevcCodec(c) {
    var space = c[1] >> 6, tier = (c[1] >> 5) & 1, profile = c[1] & 31;
    var compat = ((c[2] << 24) | (c[3] << 16) | (c[4] << 8) | c[5]) >>> 0, rev = 0;
    for (var i = 0; i < 32; i++) rev = ((rev << 1) | ((compat >>> i) & 1)) >>> 0;
    var cons = Array.prototype.slice.call(c, 6, 12);
    while (cons.length && cons[cons.length - 1] === 0) cons.pop();
    var s = "hvc1." + (space ? "ABC".charAt(space - 1) : "") + profile + "." + rev.toString(16).toUpperCase() + "." + (tier ? "H" : "L") + c[12];
    cons.forEach(function (b) { s += "." + b.toString(16).toUpperCase(); });
    return s;
  }
  function av1Codec(c) {
    var profile = c[1] >> 5, level = c[1] & 31, tier = c[2] >> 7, high = (c[2] >> 6) & 1, twelve = (c[2] >> 5) & 1;
    var depth = high ? (twelve ? 12 : 10) : 8;
    return "av01." + profile + "." + (level < 10 ? "0" : "") + level + (tier ? "H" : "M") + "." + (depth < 10 ? "0" : "") + depth;
  }
  // A frame's luma (or full colour) as 8-bit RGBA, straight from its planes: no colour management.
  async function framePixels(frame, full, lumaOnly) {
    var fmt = frame.format;
    if (!fmt) return null;
    var w = frame.visibleRect.width, h = frame.visibleRect.height, buf = new Uint8Array(frame.allocationSize());
    var layout = await frame.copyTo(buf), deep = /P1[02]/.test(fmt), out = new Uint8ClampedArray(w * h * 4);
    if (/^(RGB|BGR)/.test(fmt)) {
      var bgr = fmt.charAt(0) === "B", L0 = layout[0];
      for (var yy = 0; yy < h; yy++) {
        for (var xx = 0; xx < w; xx++) {
          var o0 = L0.offset + yy * L0.stride + xx * 4, j = (yy * w + xx) * 4;
          out[j] = buf[o0 + (bgr ? 2 : 0)]; out[j + 1] = buf[o0 + 1]; out[j + 2] = buf[o0 + (bgr ? 0 : 2)]; out[j + 3] = 255;
          if (lumaOnly) out[j + 1] = out[j + 2] = out[j];
        }
      }
      return new ImageData(out, w, h);
    }
    full = full !== false;
    var sample = function (plane, x, y) {
      var L = layout[plane], o = L.offset + y * L.stride + x * (deep ? 2 : 1);
      var v = deep ? (buf[o] | (buf[o + 1] << 8)) / (fmt.indexOf("P12") > 0 ? 16 : 4) : buf[o];
      return v;
    };
    var expandY = function (y) { return full ? y : (y - 16) * 255 / 219; };
    var expandC = function (c) { return full ? c - 128 : (c - 128) * 255 / 224; };
    var gray = lumaOnly;
    var sub = /^I420|^NV12/.test(fmt) ? 2 : /^I422/.test(fmt) ? 2 : 1, subY = /^I420|^NV12/.test(fmt) ? 2 : 1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var Y = expandY(sample(0, x, y)), i = (y * w + x) * 4, r = Y, g = Y, b = Y;
        if (!gray) {
          var cx = (x / sub) | 0, cy = (y / subY) | 0, U, Vv;
          if (/^NV12/.test(fmt)) {
            var L1 = layout[1], o1 = L1.offset + cy * L1.stride + cx * 2 * (deep ? 2 : 1);
            U = expandC(deep ? (buf[o1] | (buf[o1 + 1] << 8)) / 4 : buf[o1]);
            Vv = expandC(deep ? (buf[o1 + 2] | (buf[o1 + 3] << 8)) / 4 : buf[o1 + (deep ? 2 : 1)]);
          } else { U = expandC(sample(1, cx, cy)); Vv = expandC(sample(2, cx, cy)); }
          // BT.601 (Apple's and most stills' matrix)
          r = Y + 1.402 * Vv; g = Y - 0.344136 * U - 0.714136 * Vv; b = Y + 1.772 * U;
        }
        out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
      }
    }
    return new ImageData(out, w, h);
  }
  function videoColorSpace(nc) {
    if (!nc) return null;
    var P = { 1: "bt709", 5: "bt470bg", 6: "smpte170m", 9: "bt2020", 12: "smpte432" }[nc.primaries];
    var T = { 1: "bt709", 6: "smpte170m", 8: "linear", 13: "iec61966-2-1", 16: "pq", 18: "hlg" }[nc.transfer];
    var M = { 0: "rgb", 1: "bt709", 5: "bt470bg", 6: "smpte170m", 9: "bt2020-ncl" }[nc.matrix];
    var cs = { fullRange: nc.full };
    if (P) cs.primaries = P;
    if (T) cs.transfer = T;
    if (M) cs.matrix = M;
    return cs;
  }
  // Decodes a coded HEVC (or AV1) image item, a single image or a grid of tiles, onto a canvas.
  // mode "luma" keeps the raw luma (a greyscale gain map), "raw" the raw colour (a colour
  // gain map), "draw" lets the browser colour-manage (the photograph itself).
  async function decodeItem(h, item, mode, colorSpace) {
    if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") throw fail("no WebCodecs");
    var g = item.type === "grid" ? grid(h, item) : null, ids = g ? g.tiles : [item.id];
    if (!ids.length) throw fail("empty grid");
    var tile = h.items[ids[0]], av1 = tile && tile.type === "av01";
    if (!tile || (tile.type !== "hvc1" && !av1)) throw fail("not HEVC or AV1: " + (tile && tile.type));
    var hv = prop(tile, av1 ? "av1C" : "hvcC");
    if (!hv) throw fail("no decoder configuration");
    var desc = h.u8.slice(hv.data, hv.end);
    var config = { codec: av1 ? av1Codec(desc) : hevcCodec(desc), description: desc, optimizeForLatency: true };
    var nc = nclx(h, tile) || nclx(h, item);
    var cs = videoColorSpace(nc);
    if (cs) config.colorSpace = cs;
    else if (mode === "draw") config.colorSpace = { primaries: "smpte432", transfer: "iec61966-2-1", matrix: "smpte170m", fullRange: true };
    var support = await VideoDecoder.isConfigSupported(config);
    if (!support || !support.supported) throw fail("this browser cannot decode " + config.codec);
    var ts = size(h, tile), W = g ? g.w : (size(h, item) || ts).w, H = g ? g.h : (size(h, item) || ts).h;
    var out = canvas(W, H), ctx = mode === "draw" && colorSpace ? (out.getContext("2d", { colorSpace: colorSpace }) || out.getContext("2d")) : out.getContext("2d");
    var frames = [], error = null;
    var dec = new VideoDecoder({ output: function (f) { frames.push(f); }, error: function (e) { error = e; } });
    try {
      dec.configure(config);
      ids.forEach(function (id, k) {
        dec.decode(new EncodedVideoChunk({ type: "key", timestamp: k, data: itemData(h, h.items[id]) }));
      });
      await dec.flush();
      if (error) throw error;
      if (frames.length !== ids.length) throw fail("decoded " + frames.length + " of " + ids.length + " tiles");
      frames.sort(function (a, b) { return a.timestamp - b.timestamp; });
      var cols = g ? g.cols : 1, tw = ts ? ts.w : W, th = ts ? ts.h : H;
      for (var k = 0; k < frames.length; k++) {
        var f = frames[k], x = (k % cols) * tw, y = Math.floor(k / cols) * th;
        if (mode !== "draw") {
          var px = await framePixels(f, nc ? nc.full : true, mode === "luma");
          if (px) ctx.putImageData(px, x, y);
          else ctx.drawImage(f, x, y);
        } else ctx.drawImage(f, x, y);
      }
      return out;
    } finally {
      frames.forEach(function (f) { try { f.close(); } catch (e) {} });
      if (dec.state !== "closed") dec.close();
    }
  }
  // Applies HEIF rotation (anticlockwise quarter turns) and mirroring, in order.
  function applyOps(src, ops) {
    var cur = src;
    ops.forEach(function (op) {
      var w = cur.width, h = cur.height, turn = op[0] === "rot" ? op[1] : 0;
      var c = canvas(turn % 2 ? h : w, turn % 2 ? w : h), x = c.getContext("2d");
      if (op[0] === "rot") {
        if (turn === 1) { x.translate(0, w); x.rotate(-Math.PI / 2); }
        else if (turn === 2) { x.translate(w, h); x.rotate(Math.PI); }
        else if (turn === 3) { x.translate(h, 0); x.rotate(Math.PI / 2); }
      } else if (op[1] === 0) { x.translate(w, 0); x.scale(-1, 1); }
      else { x.translate(0, h); x.scale(1, -1); }
      x.drawImage(cur, 0, 0);
      cur = c;
    });
    return cur;
  }
  // Applies a JPEG Exif orientation (2 to 8).
  function applyOrientation(src, o) {
    if (!o || o === 1) return src;
    var w = src.width, h = src.height, swap = o >= 5, c = canvas(swap ? h : w, swap ? w : h), x = c.getContext("2d");
    var m = { 2: [-1, 0, 0, 1, w, 0], 3: [-1, 0, 0, -1, w, h], 4: [1, 0, 0, -1, 0, h], 5: [0, 1, 1, 0, 0, 0], 6: [0, 1, -1, 0, h, 0], 7: [0, -1, -1, 0, h, w], 8: [0, -1, 1, 0, 0, w] }[o];
    if (!m) return src;
    x.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    x.drawImage(src, 0, 0);
    return c;
  }
  function mapPixels(c, table) {
    var x = c.getContext("2d"), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) { d[i] = table[d[i]]; d[i + 1] = table[d[i + 1]]; d[i + 2] = table[d[i + 2]]; }
    x.putImageData(img, 0, 0);
    return c;
  }
  function aspect(c) { return c.width / c.height; }
  // Picks the orientation of the gain map that matches the photograph's shape.
  function matchShape(cands, baseAspect) {
    if (!baseAspect) return cands[0];
    var best = cands[0], bd = Infinity;
    cands.forEach(function (c) { var d = Math.abs(Math.log(aspect(c) / baseAspect)); if (d < bd) { bd = d; best = c; } });
    return bd < 0.04 ? best : null;
  }

  /* ================= Reading a photo's gain map ================= */
  function isHeif(u8) { var b = latin1(u8, 4, 12); return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1|MiHE|MiPr|miaf|avif|avis)/.test(b); }

  async function readHeif(buf, baseAspect) {
    var h = parseHeif(buf);
    if (!h || !h.items[h.primary]) return null;
    var primary = h.items[h.primary], found = null;
    // ISO 21496-1: a 'tmap' item made from the primary image and the gain map
    Object.keys(h.items).forEach(function (id) {
      var it = h.items[id];
      if (found || it.type !== "tmap") return;
      var inputs = refsFrom(h, "dimg", it.id);
      if (inputs.length < 2 || inputs[0] !== h.primary) return;
      var d = itemData(h, it);
      if (d[0] !== 0) return;
      var meta = parseIso(d.subarray(1));
      if (meta && !meta.versionOnly) found = { item: h.items[inputs[1]], meta: meta, table: null };
    });
    // Apple's HDR gain map: an auxiliary image of the primary
    if (!found) {
      h.refs.forEach(function (r) {
        if (found || r.type !== "auxl" || r.to.indexOf(h.primary) < 0) return;
        var it = h.items[r.from], aux = it ? prop(it, "auxC") : null;
        if (!aux || !/hdrgainmap/i.test(cstr(h.u8, aux.data + 4, aux.end).s)) return;
        var H = 0;
        // newer iPhones: the headroom in XMP attached to the gain map; older: in the maker notes
        h.refs.forEach(function (x) {
          if (H || x.type !== "cdsc" || x.to.indexOf(it.id) < 0) return;
          var xi = h.items[x.from];
          if (xi && xi.type === "mime" && /rdf|xmp/i.test(xi.contentType)) { var ax = appleXmp(utf8(itemData(h, xi))); if (ax && ax.headroom) H = ax.headroom; }
        });
        if (!H) {
          h.refs.forEach(function (x) {
            if (H || x.type !== "cdsc" || x.to.indexOf(h.primary) < 0) return;
            var ei = h.items[x.from];
            if (ei && ei.type === "Exif") H = appleHeadroomFromExif(tiffIn(itemData(h, ei).subarray(4)));
          });
        }
        if (H > 1.01) found = { item: it, meta: appleMeta(H), table: appleTable(H) };
      });
    }
    if (!found || !found.item) return null;
    var mode = found.meta.channels === 3 ? "raw" : "luma";
    var raw = await decodeItem(h, found.item, mode);
    var own = transforms(h, found.item), prim = transforms(h, primary);
    var cands = [applyOps(raw, own)];
    if (!own.length && prim.length) cands.unshift(applyOps(raw, prim));
    var gm = matchShape(cands, baseAspect);
    if (!gm) throw fail("gain map shape does not match the photo");
    if (found.table) mapPixels(gm, found.table);
    return { canvas: gm, meta: found.meta, source: found.table ? "apple" : "iso" };
  }

  async function readJpegGainMap(buf, baseAspect) {
    var u8 = new Uint8Array(buf), j = readJpeg(u8);
    if (!j) return null;
    var bmp = await createImageBitmap(new Blob([j.image], { type: "image/jpeg" }), { imageOrientation: "none", colorSpaceConversion: "none" });
    var c = canvas(bmp.width, bmp.height);
    c.getContext("2d").drawImage(bmp, 0, 0);
    if (bmp.close) bmp.close();
    var gm = matchShape([applyOrientation(c, j.orientation), c], baseAspect);
    if (!gm) throw fail("gain map shape does not match the photo");
    if (j.table) mapPixels(gm, j.table);
    return { canvas: gm, meta: j.meta, source: j.table ? "apple" : "iso" };
  }

  // The photo's gain map as an upright canvas plus its ISO-form metadata, or null when
  // it has none. Rejects (with .hdr set) when it has one this browser cannot read.
  async function read(file, baseAspect) {
    var buf = await file.arrayBuffer(), u8 = new Uint8Array(buf);
    if (u8.length > 12 && isHeif(u8)) return readHeif(buf, baseAspect);
    if (u8[0] === 0xFF && u8[1] === 0xD8) return readJpegGainMap(buf, baseAspect);
    return null;
  }

  // The photograph itself from a HEIC, for browsers that cannot open HEIC but can decode HEVC.
  async function decodeHeif(file, colorSpace) {
    var buf = await file.arrayBuffer(), u8 = new Uint8Array(buf);
    if (!isHeif(u8)) throw fail("not HEIF");
    var h = parseHeif(buf), primary = h && h.items[h.primary];
    if (!primary) throw fail("no primary image");
    return applyOps(await decodeItem(h, primary, "draw", colorSpace), transforms(h, primary));
  }

  /* ================= Writing a JPEG with a gain map ================= */
  function segment(marker, payload) {
    var len = payload.length + 2;
    if (len > 65535) throw fail("segment too long");
    var s = new Uint8Array(len + 2);
    s[0] = 0xFF; s[1] = marker; s[2] = len >> 8; s[3] = len & 255;
    s.set(payload, 4);
    return s;
  }
  function ascii(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
  function xmpSegment(xml) { return segment(0xE1, concat([ascii(XMP_NS + "\0"), new TextEncoder().encode(xml)])); }
  function isoSegment(body) { return segment(0xE2, concat([ascii(ISO_NS + "\0"), body])); }
  function num(x) { return String(Math.round(x * 1e6) / 1e6); }
  function primaryXmp(gainLength) {
    return '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.2">' +
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/" xmlns:hdrgm="' + HDRGM + '" hdrgm:Version="1.0">' +
      "<Container:Directory><rdf:Seq>" +
      '<rdf:li rdf:parseType="Resource"><Container:Item Item:Semantic="Primary" Item:Mime="image/jpeg"/></rdf:li>' +
      '<rdf:li rdf:parseType="Resource"><Container:Item Item:Semantic="GainMap" Item:Mime="image/jpeg" Item:Length="' + gainLength + '"/></rdf:li>' +
      "</rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>";
  }
  function gainXmp(m) {
    var one = m.channels === 1;
    var attr = function (k, v) { return " hdrgm:" + k + '="' + v + '"'; };
    var seq = function (k, vals) { return "<hdrgm:" + k + "><rdf:Seq>" + vals.map(function (x) { return "<rdf:li>" + num(x) + "</rdf:li>"; }).join("") + "</rdf:Seq></hdrgm:" + k + ">"; };
    var head = '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.2"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:hdrgm="' + HDRGM + '"' + attr("Version", "1.0") +
      attr("HDRCapacityMin", num(m.baseHeadroom)) + attr("HDRCapacityMax", num(m.altHeadroom)) + attr("BaseRenditionIsHDR", "False");
    if (one) {
      return head + attr("GainMapMin", num(m.min[0])) + attr("GainMapMax", num(m.max[0])) + attr("Gamma", num(m.gamma[0])) +
        attr("OffsetSDR", num(m.baseOffset[0])) + attr("OffsetHDR", num(m.altOffset[0])) + "/></rdf:RDF></x:xmpmeta>";
    }
    return head + ">" + seq("GainMapMin", m.min) + seq("GainMapMax", m.max) + seq("Gamma", m.gamma) +
      seq("OffsetSDR", m.baseOffset) + seq("OffsetHDR", m.altOffset) + "</rdf:Description></rdf:RDF></x:xmpmeta>";
  }
  function mpfSegment(primarySize, gainSize, gainOffset) {
    var p = new Uint8Array(86), dv = new DataView(p.buffer);
    p.set(ascii("MPF\0"), 0);
    p.set([0x4D, 0x4D, 0x00, 0x2A], 4);          // big-endian TIFF header
    dv.setUint32(8, 8);
    dv.setUint16(12, 3);                          // three entries
    dv.setUint16(14, 0xB000); dv.setUint16(16, 7); dv.setUint32(18, 4); p.set(ascii("0100"), 22);
    dv.setUint16(26, 0xB001); dv.setUint16(28, 4); dv.setUint32(30, 1); dv.setUint32(34, 2);
    dv.setUint16(38, 0xB002); dv.setUint16(40, 7); dv.setUint32(42, 32); dv.setUint32(46, 50);
    dv.setUint32(50, 0);                          // no next IFD
    dv.setUint32(54, 0x00030000); dv.setUint32(58, primarySize); dv.setUint32(62, 0);
    dv.setUint32(70, 0); dv.setUint32(74, gainSize); dv.setUint32(78, gainOffset);
    return segment(0xE2, p);
  }
  // The gain map's own JPEG, without the colour profile a browser's encoder adds: gain
  // values are data, and a decoder must not colour-manage them.
  function bareGain(gain) {
    var keep = [gain.subarray(0, 2)], p = 2;
    segments(gain, 0).forEach(function (s) {
      var at = s.data - 4;
      if (at > p) keep.push(gain.subarray(p, at));
      var drop = s.m === 0xE0 || (s.m === 0xE2 && startsWith(gain, s.data, "ICC_PROFILE\0"));
      if (!drop) keep.push(gain.subarray(at, s.end));
      p = s.end;
    });
    keep.push(gain.subarray(p));
    return concat(keep);
  }
  // One JPEG out of the photograph and its gain map; extra segments (the Exif block) go first.
  function join(base, gain, meta, extra) {
    extra = extra || [];
    gain = bareGain(gain);
    var secondary = concat([gain.subarray(0, 2), xmpSegment(gainXmp(meta)), isoSegment(encodeIso(meta)), gain.subarray(2)]);
    var head = base[2] === 0xFF && base[3] === 0xE0 ? 4 + ((base[4] << 8) | base[5]) : 2;
    var pre = base.subarray(0, head), rest = base.subarray(head);
    var xmp = xmpSegment(primaryXmp(secondary.length)), ver = isoSegment(new Uint8Array(4));
    var before = pre.length + xmp.length + ver.length;
    extra.forEach(function (s) { before += s.length; });
    var primaryLen = before + 90 + rest.length, tiffAt = before + 8;
    var mpf = mpfSegment(primaryLen, secondary.length, primaryLen - tiffAt);
    return concat([pre].concat(extra, [xmp, ver, mpf, rest, secondary]));
  }

  window.StudioHDR = { read: read, join: join, decodeHeif: decodeHeif, _test: { parseHeif: parseHeif, parseIso: parseIso, encodeIso: encodeIso, readJpeg: readJpeg, appleTable: appleTable, appleHeadroomFromExif: appleHeadroomFromExif, hevcCodec: hevcCodec, av1Codec: av1Codec, decodeItem: decodeItem, grid: grid, gainXmp: gainXmp, isHeif: isHeif, tiffIn: tiffIn } };
})();
