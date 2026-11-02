/*
 * Gallery Studio
 * Prepares photos in the browser and publishes them to the site's GitHub repository.
 *
 * For each photo:
 *   - decode (EXIF orientation applied) and resize to <= 2000px on the long edge,
 *     plus a <= 900px thumbnail;
 *   - re-encode as JPEG, which drops every original metadata block (GPS included);
 *   - keep HDR (studio-hdr.js): a photo with a gain map (iPhone HEIC, Ultra HDR JPEG)
 *     keeps it, resized with the photo; a PQ or HLG photo (HDR AVIF or HEIF) becomes an
 *     SDR picture plus a gain map made from its full brightness; either way one JPEG;
 *   - embed a small EXIF block holding only Artist and Copyright;
 *   - optionally draw a subtle "© year name" watermark in the bottom-right corner.
 * Publishing writes the images to img/gallery/ and prepends one line per photo to
 * _data/gallery.yml, all in a single commit on main through the GitHub REST API.
 * The token is kept in this browser only (session storage, or local storage when
 * "Remember" is checked) and is sent only to api.github.com.
 */
(function () {
  "use strict";

  var root = document.getElementById("studio");
  if (!root) return;

  var OWNER = root.getAttribute("data-owner");
  var REPO = root.getAttribute("data-repo");
  var BRANCH = root.getAttribute("data-branch") || "main";
  var AUTHOR = root.getAttribute("data-author") || "";
  var API = "https://api.github.com";
  var YEAR = new Date().getFullYear();
  var THUMB_EDGE = 900;
  var THUMB_QUALITY = 0.82;
  var GAIN_QUALITY = 0.9;
  var SETTINGS_KEY = "gallery-studio-settings";
  var OWNER_KEY = "gallery-studio-owner";
  var DEFAULTS = {
    edge: 2000, quality: 86,
    wmOn: true, wmText: "\u00A9 " + YEAR + " " + AUTHOR, wmPos: "br", wmSize: "s", wmOpacity: 60,
    copyright: "Copyright " + YEAR + " " + AUTHOR + ". All rights reserved.", artist: AUTHOR,
    camera: true, place: true
  };
  var DATA_PATH = "_data/gallery.yml";
  // Size and quality a single photo can be published at, instead of the settings.
  var QUALITY = [
    { key: "small", label: "Small · 1600 px, 82", edge: 1600, quality: 82 },
    { key: "standard", label: "Standard · 2000 px, 86", edge: 2000, quality: 86 },
    { key: "high", label: "High · 3000 px, 90", edge: 3000, quality: 90 },
    { key: "full", label: "Full · 4000 px, 93", edge: 4000, quality: 93 }
  ];
  var IMG_DIR = "img/gallery/";
  var TOKEN_KEY = "gallery-studio-token";

  var $ = function (id) { return document.getElementById(id); };
  var tokenInput = $("token"), rememberBox = $("remember"), connectBtn = $("connect");
  var connectForm = $("connect-form"), connectedBox = $("connected"), connectedText = $("connected-text");
  var connectStatus = $("connect-status"), disconnectBtn = $("disconnect");
  var filesInput = $("files"), drop = $("drop"), watermarkBox = $("watermark");
  var queueList = $("queue"), publishBtn = $("publish"), publishStatus = $("publish-status");
  var pubList = $("pub-list"), pubEmpty = $("pub-empty");
  var deleteAllBox = $("pub-delete-all"), deleteAllBtn = $("delete-all"), deleteAllStatus = $("delete-all-status");
  var datesBox = $("pub-dates"), datesInfo = $("dates-info"), datesBtn = $("dates-pick"), datesInput = $("dates-files"), datesStatus = $("dates-status");

  var token = null;
  var settings = loadSettings();
  var queue = [];        // { id, file, name, title, place, year, status, full, thumb, w, h, preview }
  var published = [];    // entries parsed from gallery.yml
  var busy = false;

  // ---------- storage (never required; wrapped in try/catch) ----------
  function readToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function writeToken(t, remember) {
    try {
      if (remember) { localStorage.setItem(TOKEN_KEY, t); sessionStorage.removeItem(TOKEN_KEY); }
      else { sessionStorage.setItem(TOKEN_KEY, t); localStorage.removeItem(TOKEN_KEY); }
    } catch (e) { /* storage blocked: the token lives in memory for this visit */ }
  }
  function forgetToken() {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  // ---------- GitHub API ----------
  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body, cache: "no-store" })
      .then(function (r) {
        if (r.status === 204) return null;
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) {
            var err = new Error(data && data.message ? data.message : "HTTP " + r.status);
            err.status = r.status;
            throw err;
          }
          return data;
        });
      });
  }
  var repoPath = function () { return "/repos/" + OWNER + "/" + REPO; };

  function explain(err, action) {
    var s = err && err.status;
    if (err && err.readOnly) return "This token can only read. On GitHub, edit the token: under Repository access choose Only select repositories and pick WtSg/WtSg.github.io, then under Permissions add Contents and set it to Read and write. Save, then sign in again.";
    if (s === 401) return "That password didn't work. Check it was pasted in full and hasn't expired, then try again.";
    if (s === 403 || s === 404) return "The token can't " + action + " WtSg/WtSg.github.io. On GitHub, edit the token: Repository access → Only select repositories → WtSg/WtSg.github.io, and Permissions → Contents → Read and write.";
    if (s === 409 || s === 422) return "The site changed while publishing. Press the button again.";
    if (err instanceof TypeError) return "Couldn't reach GitHub. Check your internet connection and try again.";
    return "Something went wrong (" + (err && err.message ? err.message : "unknown error") + "). Try again.";
  }

  // ---------- base64 / UTF-8 helpers ----------
  function bytesToBase64(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function base64ToText(b64) {
    var bin = atob(b64.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---------- gallery.yml (one JSON flow mapping per line, valid YAML) ----------
  var DEFAULT_HEADER = [
    "# Photography gallery, in the order the photos were taken, the newest first.",
    "# Written by the Gallery Studio (www.wshangguan.com/studio/): one photo per line.",
    "# Each line is a YAML flow mapping with id, src, thumb, w, h, title, place, year, taken, exif, added.",
    "# You can edit a title, place or year here by hand; keep each photo on one line."
  ];
  function parseGallery(text) {
    var header = [], entries = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (/^\s*#/.test(line) || !line.trim()) { if (!entries.length && /^\s*#/.test(line)) header.push(line); return; }
      var m = line.match(/^-\s*(\{.*\})\s*$/);
      if (m) { try { entries.push(JSON.parse(m[1])); } catch (e) { /* skip a line edited into non-JSON form */ } }
    });
    return { header: header.length ? header : DEFAULT_HEADER, entries: entries };
  }
  // The gallery's order: when each photo was taken, the newest first (never when its file
  // was last edited or when it was added). A photo with no date taken goes by its year,
  // after those of that year that have one, in the order it already has (the sort is
  // stable); no year at all goes last.
  function sortKey(e) {
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(e.taken || "")) return e.taken;
    return /^\d{4}$/.test(e.year || "") ? e.year + "-00" : "";
  }
  function byTaken(entries) {
    return entries.map(function (e, k) { return { e: e, k: k, s: sortKey(e) }; })
      .sort(function (a, b) { return a.s < b.s ? 1 : a.s > b.s ? -1 : a.k - b.k; })
      .map(function (x) { return x.e; });
  }
  function serializeGallery(header, entries) {
    var lines = header.slice();
    byTaken(entries).forEach(function (e) {
      lines.push("- " + JSON.stringify({
        id: e.id, src: e.src, thumb: e.thumb, w: e.w, h: e.h,
        title: e.title || "", place: e.place || "", year: e.year || "", taken: e.taken || undefined,
        exif: e.exif || undefined, camera: e.camera || undefined, added: e.added || ""
      }));
    });
    return lines.join("\n") + "\n";
  }
  function fetchGallery() {
    return gh(repoPath() + "/contents/" + DATA_PATH + "?ref=" + encodeURIComponent(BRANCH))
      .then(function (f) { return parseGallery(base64ToText(f.content || "")); })
      .catch(function (err) {
        if (err.status === 404) return { header: DEFAULT_HEADER, entries: [] };
        throw err;
      });
  }

  // ---------- EXIF: read when it was taken and the camera details; write Artist + Copyright ----------
  // Reads a JPEG's EXIF for when it was taken (the year, the date, and to the second, for
  // the gallery's order) and a one-line camera summary
  // ("ILCE-7M4 · FE 35mm F1.8 · 35 mm · f/2 · 1/250 s · ISO 100"). Only these
  // values are kept, for captions; the published file never carries them.
  // tiffAt, when given, is where the TIFF block starts in buf (an Exif item or box read on its own).
  function readExifInfo(buf, tiffAt) {
    var info = { found: false, year: "", date: "", taken: "", lat: null, lon: null, camera: "", lens: "", focal: "", aperture: "", shutter: "", iso: "", summary: "" };
    try {
      var v = new DataView(buf), bytes = new Uint8Array(buf), t = -1;
      if (tiffAt !== undefined) {
        var tb = tiffAt + 4 <= bytes.length ? bytes.subarray(tiffAt, tiffAt + 4) : [];
        if ((tb[0] === 0x49 && tb[1] === 0x49 && tb[2] === 0x2A && tb[3] === 0) || (tb[0] === 0x4D && tb[1] === 0x4D && tb[2] === 0 && tb[3] === 0x2A)) t = tiffAt;
      } else if (v.byteLength > 4 && v.getUint16(0) === 0xFFD8) {
        var off = 2;
        while (off + 10 < v.byteLength) {
          var marker = v.getUint16(off), len = v.getUint16(off + 2);
          if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { t = off + 10; break; }   // "Exif"
          if ((marker & 0xFF00) !== 0xFF00) break;
          off += 2 + len;
        }
      } else {
        // HEIC / HEIF / AVIF keep EXIF as an item: find "Exif\0\0" followed by a TIFF header.
        for (var k0 = 0; k0 + 10 < bytes.length; k0++) {
          if (bytes[k0] === 0x45 && bytes[k0 + 1] === 0x78 && bytes[k0 + 2] === 0x69 && bytes[k0 + 3] === 0x66 &&
              bytes[k0 + 4] === 0 && bytes[k0 + 5] === 0 &&
              ((bytes[k0 + 6] === 0x4D && bytes[k0 + 7] === 0x4D && bytes[k0 + 9] === 0x2A) ||
               (bytes[k0 + 6] === 0x49 && bytes[k0 + 7] === 0x49 && bytes[k0 + 8] === 0x2A))) { t = k0 + 6; break; }
        }
      }
      if (t < 0) return info;
      var little = v.getUint16(t) === 0x4949;
      var u16 = function (q) { return v.getUint16(t + q, little); };
      var u32 = function (q) { return v.getUint32(t + q, little); };
      var entries = function (ifd) {
        var map = {}, n = u16(ifd);
        for (var i2 = 0; i2 < n; i2++) { var e = ifd + 2 + i2 * 12; map[u16(e)] = e; }
        return map;
      };
      var value = function (e) {
        var type = u16(e + 2), count = u32(e + 4);
        var size = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 }[type] || 1;
        var q = size * count <= 4 ? e + 8 : u32(e + 8);
        if (type === 2) {
          var str = "";
          for (var k = 0; k < count; k++) { var c = v.getUint8(t + q + k); if (!c) break; str += String.fromCharCode(c); }
          return str.trim();
        }
        if (type === 3) return u16(q);
        if (type === 4) return u32(q);
        if (type === 5) { var den = u32(q + 4); return den ? u32(q) / den : 0; }
        if (type === 10) { var d2 = v.getInt32(t + q + 4, little); return d2 ? v.getInt32(t + q, little) / d2 : 0; }
        if (type === 11) return v.getFloat32(t + q, little);
        if (type === 12) return v.getFloat64(t + q, little);
        return null;
      };
      var ifd0 = entries(u32(4));
      var exif = ifd0[0x8769] !== undefined ? entries(u32(ifd0[0x8769] + 8)) : {};
      var get = function (map, tag) { return map[tag] !== undefined ? value(map[tag]) : null; };
      info.found = true;
      // when it was taken (DateTimeOriginal, else DateTimeDigitized), never DateTime, which
      // is when the file was last changed (an edit, an export)
      var date = String(get(exif, 0x9003) || get(exif, 0x9004) || "");
      if (/^\d{4}/.test(date) && date.slice(0, 4) !== "0000") info.year = date.slice(0, 4);
      if (/^\d{4}:\d\d:\d\d/.test(date) && info.year) info.date = date.slice(0, 10).replace(/:/g, "-");
      var tk = /^(\d{4}):(\d\d):(\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(date);
      if (tk && info.year) info.taken = tk[1] + "-" + tk[2] + "-" + tk[3] + "T" + tk[4] + ":" + tk[5] + ":" + tk[6];
      // Where it was taken: only to look up the town for the Place field; never published.
      if (ifd0[0x8825] !== undefined) {
        var gps = entries(u32(ifd0[0x8825] + 8));
        var dms = function (tag) {
          var e = gps[tag];
          if (e === undefined || u16(e + 2) !== 5 || u32(e + 4) < 3) return null;
          var q = u32(e + 8), out = 0;
          for (var j = 0; j < 3; j++) { var dn = u32(q + j * 8 + 4); out += (dn ? u32(q + j * 8) / dn : 0) / Math.pow(60, j); }
          return out;
        };
        var la = dms(2), lo = dms(4);
        if (la !== null && lo !== null && (la || lo)) {
          info.lat = String(get(gps, 1) || "N").toUpperCase() === "S" ? -la : la;
          info.lon = String(get(gps, 3) || "E").toUpperCase() === "W" ? -lo : lo;
        }
      }
      var make = String(get(ifd0, 0x010F) || ""), model = String(get(ifd0, 0x0110) || "");
      var brand = make.split(" ")[0].toLowerCase();
      info.camera = model && brand && model.toLowerCase().indexOf(brand) === 0 ? model : [make, model].filter(Boolean).join(" ");
      // some lenses report a constant aperture as a range ("E 28-75mm F2.8-2.8")
      info.lens = String(get(exif, 0xA434) || "").replace(/F(\d+(?:\.\d+)?)-\1(?![\d.])/, "F$1");
      if (info.lens === info.camera) info.lens = "";
      // iPhones name themselves in the lens ("iPhone 13 Pro back triple camera 9mm f/2.8")
      var phone = /^(iPhone[^,]*?|iPad[^,]*?)\s+((?:back|front)\b.*)$/i.exec(info.lens);
      if (phone) {
        if (!info.camera || /^apple$/i.test(info.camera) || info.camera.toLowerCase().indexOf(phone[1].toLowerCase()) >= 0) info.camera = phone[1];
        info.lens = phone[2];
      }
      var focal = get(exif, 0x920A), fnum = get(exif, 0x829D), exp = get(exif, 0x829A), iso = get(exif, 0x8827);
      if (focal) info.focal = Math.round(focal) + " mm";
      if (fnum) info.aperture = "f/" + Math.round(fnum * 10) / 10;
      if (exp) info.shutter = exp >= 1 ? Math.round(exp * 10) / 10 + " s" : "1/" + Math.round(1 / exp) + " s";
      if (iso) info.iso = "ISO " + iso;
      info.summary = [info.camera, info.lens, info.focal, info.aperture, info.shutter, info.iso].filter(Boolean).join(" · ");
    } catch (e) {}
    return info;
  }
  function readExifYear(buf) { return readExifInfo(buf).year; }
  // True when the file is an HDR photo: a gain-map image (Ultra HDR / Adobe gain map
  // JPEG, Apple HEIC with an HDR gain map) or a PQ / HLG encoded AVIF or HEIC.
  function detectHdr(buf) {
    try {
      var bytes = new Uint8Array(buf);
      var text = new TextDecoder("latin1").decode(bytes);
      if (/hdrgm:|hdrgainmap|urn:iso:std:iso:ts:21496|HDRGainMap/i.test(text)) return true;
      var i = text.indexOf("nclx");
      while (i >= 0) {
        var transfer = (bytes[i + 6] << 8) | bytes[i + 7];      // after primaries (u16)
        if (transfer === 16 || transfer === 18) return true;    // PQ (16) or HLG (18)
        i = text.indexOf("nclx", i + 4);
      }
    } catch (e) {}
    return false;
  }
  function exifSegment(artist, copyright) {
    var enc = function (s) {
      var utf8 = new TextEncoder().encode(String(s || "").replace(/[\x00-\x1F]/g, ""));
      var b = new Uint8Array(utf8.length + 1);
      b.set(utf8);
      return b;                                                    // NUL-terminated (UTF-8, read by common tools)
    };
    var a = enc(artist), c = enc(copyright);
    var ifdSize = 2 + 2 * 12 + 4, aOff = 8 + ifdSize, cOff = aOff + a.length + (a.length % 2);
    var tiff = new Uint8Array(cOff + c.length), dv = new DataView(tiff.buffer);
    tiff.set([0x4D, 0x4D, 0x00, 0x2A]);                            // big-endian TIFF header
    dv.setUint32(4, 8);
    dv.setUint16(8, 2);
    var entry = function (p, tag, bytes, off) {
      dv.setUint16(p, tag); dv.setUint16(p + 2, 2); dv.setUint32(p + 4, bytes.length);
      if (bytes.length <= 4) tiff.set(bytes, p + 8); else dv.setUint32(p + 8, off);
    };
    entry(10, 0x013B, a, aOff);                                    // Artist
    entry(22, 0x8298, c, cOff);                                    // Copyright
    dv.setUint32(34, 0);                                           // no next IFD
    tiff.set(a, aOff); tiff.set(c, cOff);
    var head = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];               // "Exif\0\0"
    var len = 2 + head.length + tiff.length;
    var seg = new Uint8Array(2 + len);
    seg[0] = 0xFF; seg[1] = 0xE1; seg[2] = len >> 8; seg[3] = len & 0xFF;
    seg.set(head, 4); seg.set(tiff, 4 + head.length);
    return seg;
  }
  function insertSegment(jpeg, seg) {
    var pos = 2;                                                   // after SOI
    if (jpeg[2] === 0xFF && jpeg[3] === 0xE0) pos = 4 + ((jpeg[4] << 8) | jpeg[5]); // after JFIF APP0
    var out = new Uint8Array(jpeg.length + seg.length);
    out.set(jpeg.subarray(0, pos)); out.set(seg, pos); out.set(jpeg.subarray(pos), pos + seg.length);
    return out;
  }

  // ---------- image processing ----------
  var HDR = window.StudioHDR || null;
  function decode(file) {
    var p = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return decodeWithImg(file); })
      : decodeWithImg(file);
    // A browser that cannot open HEIC may still decode HEVC: draw the photo from its tiles.
    if (HDR && HDR.decodeHeif) p = p.catch(function (err) { return HDR.decodeHeif(file, COLOR_SPACE).catch(function () { throw err; }); });
    return p;
  }
  function decodeWithImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { resolve(im); setTimeout(function () { URL.revokeObjectURL(url); }, 0); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
      im.src = url;
    });
  }
  // Draw in Display P3 where the browser supports it, so wide-colour and HDR photos
  // keep their colour; the encoder then tags the JPEG with a Display P3 profile.
  var COLOR_SPACE = (function () {
    try {
      var ctx = document.createElement("canvas").getContext("2d", { colorSpace: "display-p3" });
      return ctx && ctx.getContextAttributes && ctx.getContextAttributes().colorSpace === "display-p3" ? "display-p3" : "srgb";
    } catch (e) { return "srgb"; }
  })();
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function ctx2d(c, plain) { return plain ? c.getContext("2d") : (c.getContext("2d", { colorSpace: COLOR_SPACE }) || c.getContext("2d")); }
  // Halve repeatedly, then do the final step, for clean downscaling in every browser.
  // A gain map is scaled "plain": its values are data, never colour-converted.
  function scaleTo(src, sw, sh, w, h, plain) {
    var cur = src, cw = sw, ch = sh;
    while (cw / 2 >= w && ch / 2 >= h) {
      var half = canvas(Math.round(cw / 2), Math.round(ch / 2)), hc = ctx2d(half, plain);
      hc.imageSmoothingEnabled = true; hc.imageSmoothingQuality = "high";
      hc.drawImage(cur, 0, 0, half.width, half.height);
      cur = half; cw = half.width; ch = half.height;
    }
    var out = canvas(w, h), ctx = ctx2d(out, plain);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, w, h);
    return out;
  }
  function drawWatermark(c, st) {
    var text = (st.wmText || "").trim();
    if (!text) return;
    var ctx = ctx2d(c), L = Math.max(c.width, c.height);
    var factor = { s: 0.0125, m: 0.02, l: 0.03 }[st.wmSize] || 0.0125;
    var size = Math.max(11, Math.round(L * factor)), pad = Math.round(L * 0.018);
    var a = Math.min(0.9, Math.max(0.2, (st.wmOpacity || 60) / 100));
    var pos = st.wmPos || "br";
    ctx.save();
    ctx.font = "400 " + size + "px \"DejaVu Sans\", Verdana, sans-serif";
    ctx.textAlign = pos === "c" ? "center" : (pos.charAt(1) === "l" ? "left" : "right");
    ctx.textBaseline = pos === "c" ? "middle" : (pos.charAt(0) === "t" ? "top" : "alphabetic");
    ctx.shadowColor = "rgba(0, 0, 0, " + (0.58 * a).toFixed(3) + ")";
    ctx.shadowBlur = Math.max(2, Math.round(size * 0.3));
    ctx.shadowOffsetY = Math.max(1, Math.round(size * 0.06));
    ctx.fillStyle = "rgba(255, 255, 255, " + a.toFixed(3) + ")";
    var x = pos === "c" ? c.width / 2 : (pos.charAt(1) === "l" ? pad : c.width - pad);
    var y = pos === "c" ? c.height / 2 : (pos.charAt(0) === "t" ? pad : c.height - pad);
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  // A canvas as JPEG bytes. Some browsers return nothing for a wide-colour canvas, or one
  // too large for them: then the picture is copied into a plain sRGB canvas and tried again.
  function blobOf(c, q) {
    return new Promise(function (resolve) { c.toBlob(resolve, "image/jpeg", q); });
  }
  function toJpegBytes(c, q) {
    if (!c.width || !c.height) return Promise.reject(new Error("encode: empty picture (" + c.width + " × " + c.height + ")"));
    return blobOf(c, q).then(function (b) {
      if (b) return b;
      var plain = document.createElement("canvas");
      plain.width = c.width; plain.height = c.height;
      var x = plain.getContext("2d");
      if (!x) throw new Error("encode: no canvas (" + c.width + " × " + c.height + ")");
      x.drawImage(c, 0, 0);
      return blobOf(plain, q).then(function (b2) {
        plain.width = plain.height = 0;
        if (!b2) throw new Error("encode (" + c.width + " × " + c.height + ")");
        return b2;
      });
    }).then(function (b) { return b.arrayBuffer(); }).then(function (ab) { return new Uint8Array(ab); });
  }
  var fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load("400 24px \"DejaVu Sans\"").catch(function () {})
    : Promise.resolve();

  function prepare(item) {
    // this photo's own size and quality, where one was chosen for it
    var s = Object.assign({}, settings, item.edge ? { edge: item.edge, quality: item.quality } : {});
    var seg = exifSegment(s.artist, s.copyright);
    return Promise.all([decode(item.file), fontReady]).then(function (res) {
      var bmp = res[0];
      var sw = bmp.width || bmp.naturalWidth, sh = bmp.height || bmp.naturalHeight;
      // The HDR gain map, if the photo has one this browser can read.
      // AV1 this browser can't decode is read tile by tile in WebAssembly: slow, so say how far it got
      var onProgress = function (done, total) {
        item.note = "reading its HDR here, part " + Math.min(total, done + 1) + " of " + total + "…";
        var m = queueList.querySelector('[data-key="' + item.key + '"] .queue__meta');
        if (m && item.status === "preparing") m.textContent = item.name + " · " + item.note;
      };
      var gmP = HDR ? HDR.read(item.file, sw / sh, { maxEdge: s.edge, colorSpace: COLOR_SPACE, onProgress: onProgress }).catch(function (e) {
        item.hdrProblem = (e && e.message) || "unreadable";
        if (window.console) console.warn("Gallery Studio: the HDR gain map of " + item.name + " was not kept (" + item.hdrProblem + ").");
        return null;
      }) : Promise.resolve(null);
      return gmP.then(function (gm) {
        // A PQ or HLG photo comes back with its own SDR picture, the one its gain map was made against.
        var src = gm && gm.base ? gm.base : bmp;
        if (src !== bmp) { if (bmp.close) bmp.close(); sw = src.width; sh = src.height; }
        if (gm && !gm.canvas) { item.hdrSource = gm.source; gm = null; }
        var k = Math.min(1, s.edge / Math.max(sw, sh));
        var w = Math.round(sw * k), h = Math.round(sh * k);
        var full = scaleTo(src, sw, sh, w, h);
        if (src.close) src.close();
        if (s.wmOn) drawWatermark(full, s);
        var t = Math.min(1, THUMB_EDGE / Math.max(w, h));
        var tw = Math.round(w * t), th = Math.round(h * t);
        var thumb = scaleTo(full, w, h, tw, th);
        item.print = fingerprintOf(thumb);
        var jobs = [toJpegBytes(full, s.quality / 100), toJpegBytes(thumb, THUMB_QUALITY)];
        if (gm) {
          // The gain map keeps its share of the photo's resolution (an iPhone's is half).
          var r = Math.min(1, Math.max(0.25, gm.canvas.width / sw));
          var gFull = scaleTo(gm.canvas, gm.canvas.width, gm.canvas.height, Math.max(1, Math.round(w * r)), Math.max(1, Math.round(h * r)), true);
          var gThumb = scaleTo(gFull, gFull.width, gFull.height, Math.max(1, Math.round(tw * r)), Math.max(1, Math.round(th * r)), true);
          jobs.push(toJpegBytes(gFull, GAIN_QUALITY), toJpegBytes(gThumb, GAIN_QUALITY));
        }
        return Promise.all(jobs).then(function (out) {
          if (gm) {
            item.full = HDR.join(out[0], out[2], gm.meta, [seg]);
            item.thumb = HDR.join(out[1], out[3], gm.meta, [seg]);
          } else {
            item.full = insertSegment(out[0], seg);
            item.thumb = insertSegment(out[1], seg);
          }
          item.hdrKept = !!gm;
          if (gm) item.hdrSource = gm.source;
          item.w = w; item.h = h;
          item.preview = URL.createObjectURL(new Blob([item.thumb], { type: "image/jpeg" }));
        });
      });
    });
  }

  // ---------- duplicates ----------
  // A photograph's fingerprint, taken from the copy that is published (its thumbnail):
  // averaged down to 17 x 16 grey, then which way each pair of neighbours goes (a 256-bit
  // difference hash). The same picture resized, recompressed, re-exported or watermarked
  // keeps nearly all of it; another picture, even of the same place, shares far less.
  var FP_W = 17, FP_H = 16, DUP_BITS = 40;
  function fingerprintOf(src) {
    var w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height, w = w0, h = h0, cur = src;
    if (!w || !h) return null;
    try {
      while (w > 4 * FP_W && h > 4 * FP_H) {
        var half = document.createElement("canvas");
        half.width = Math.round(w / 2); half.height = Math.round(h / 2);
        var hx = half.getContext("2d");
        hx.imageSmoothingQuality = "high";
        hx.drawImage(cur, 0, 0, half.width, half.height);
        cur = half; w = half.width; h = half.height;
      }
      var c = document.createElement("canvas");
      c.width = FP_W; c.height = FP_H;
      var x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(cur, 0, 0, FP_W, FP_H);
      var d = x.getImageData(0, 0, FP_W, FP_H).data, g = [], bits = [];
      for (var i = 0; i < FP_W * FP_H; i++) g.push(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
      for (var y = 0; y < FP_H; y++) for (var k = 0; k < FP_W - 1; k++) bits.push(g[y * FP_W + k] < g[y * FP_W + k + 1] ? 1 : 0);
      return { bits: bits, ar: w0 / h0 };
    } catch (e) { return null; }    // a picture this page may not read: no fingerprint, no match
  }
  function fpDistance(a, b) { var n = 0; for (var i = 0; i < a.bits.length; i++) if (a.bits[i] !== b.bits[i]) n++; return n; }
  function samePicture(a, b) { return !!(a && b) && Math.abs(Math.log(a.ar / b.ar)) < 0.02 && fpDistance(a, b) <= DUP_BITS; }
  // Different exposure settings on both sides: not the same frame, however alike.
  function exifClash(a, b) {
    if (!a || !b) return false;
    return ["aperture", "shutter", "iso", "focal"].some(function (k) { return a[k] && b[k] && a[k] !== b[k]; });
  }
  var pubPrints = {};
  function publishedPrint(e) {
    if (e.print) return Promise.resolve(e.print);
    if (!pubPrints[e.id]) {
      pubPrints[e.id] = new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(fingerprintOf(im)); };
        im.onerror = function () { res(null); };
        im.src = e.localPreview || e.thumb;
      });
    }
    return pubPrints[e.id];
  }
  // Is this photo already in the gallery, or already in the list above it? Say so, and leave
  // it out of publishing unless asked ("Publish anyway"). Nothing is ever dropped silently.
  function checkDuplicate(item) {
    if (!item || item.status !== "ready") return Promise.resolve();
    var at = queue.indexOf(item), before = queue.slice(0, Math.max(0, at)), found = null;
    before.forEach(function (q) {
      if (found || q.status !== "ready") return;
      var f = q.file, g = item.file;
      if (f && g && f.name === g.name && f.size === g.size && f.lastModified === g.lastModified) found = "This file is already in the list above.";
      else if (samePicture(item.print, q.print) && !exifClash(item.exif, q.exif)) found = "Looks like " + q.name + ", already in the list above.";
    });
    if (found) { setDup(item, found); return Promise.resolve(); }
    if (!item.print || !published.length) { setDup(item, null); return Promise.resolve(); }
    var list = published.slice();
    return Promise.all(list.map(publishedPrint)).then(function (prints) {
      var best = -1, bd = Infinity;
      prints.forEach(function (fp, k) {
        if (!samePicture(item.print, fp) || exifClash(item.exif, list[k].exif)) return;
        var dd = fpDistance(item.print, fp);
        if (dd < bd) { bd = dd; best = k; }
      });
      if (best < 0) { setDup(item, null); return; }
      var e = list[best], where = [e.year, e.place].filter(Boolean).join(" · ");
      setDup(item, "Looks like No. " + (published.indexOf(e) + 1) + (e.title ? ", " + e.title + "," : "") + " already in your gallery" + (where ? " (" + where + ")" : "") + ".");
    });
  }
  function setDup(item, text) {
    if (item.dup === text) return;
    item.dup = text;
    if (queue.indexOf(item) >= 0) renderItem(item);
    updatePublish();
  }

  // ---------- naming ----------
  function slugify(s) {
    return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
  }
  // A file name is never a title (camera numbers, "All Photos 1 of 1 (1)", exports):
  // the title starts empty and is only what is typed.
  function titleFromName() { return ""; }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function newId(title) {
    var stamp = today().replace(/-/g, ""), rand = Math.random().toString(36).slice(2, 6);
    return stamp + "-" + slugify(title) + "-" + rand;
  }
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  // ---------- queue UI ----------
  function addFiles(list) {
    var files = Array.prototype.filter.call(list, function (f) { return /^image\//.test(f.type) || /\.(heic|heif|avif|jxl|jpe?g|png|webp)$/i.test(f.name); });
    if (!files.length) { setStatus(publishStatus, "Those files aren't photos. Choose JPEG, HEIC, AVIF, PNG or WebP images.", "error"); return; }
    setStatus(publishStatus, "");
    files.forEach(function (file) {
      var item = { key: Math.random().toString(36).slice(2), file: file, name: file.name, title: titleFromName(file.name), place: "", year: "", status: "preparing" };
      queue.push(item);
      renderItem(item);
    });
    updatePublish();
    processPending();
  }

  // JPEG XL keeps Exif in a box of its container ("Exif", or "brob" holding it Brotli-
  // compressed): walk the boxes, reading only their headers, and return its content.
  var JXL = [0, 0, 0, 12, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A];
  function isJxl(u8) { for (var i = 0; i < 12; i++) if (u8[i] !== JXL[i]) return false; return true; }
  function jxlExif(f) {
    var p = 0, steps = 0;
    var next = function () {
      if (p + 8 > f.size || steps++ > 64) return null;
      return f.slice(p, p + 20).arrayBuffer().then(function (hb) {
        var v = new DataView(hb), size = v.getUint32(0), head = 8, type = "", inner = "";
        for (var i = 4; i < 8; i++) type += String.fromCharCode(v.getUint8(i));
        if (size === 1) { size = v.getUint32(8) * 4294967296 + v.getUint32(12); head = 16; }
        else if (size === 0) size = f.size - p;
        if (size < head) return null;
        var start = p + head, end = p + size;
        p = end;
        if (end - start > 4194304) return next();
        if (type === "Exif") return f.slice(start, end).arrayBuffer();
        if (type === "brob" && hb.byteLength >= head + 4) {
          for (var j = head; j < head + 4; j++) inner += String.fromCharCode(v.getUint8(j));
          if (inner === "Exif") {
            try {
              return new Response(f.slice(start + 4, end).stream().pipeThrough(new DecompressionStream("brotli"))).arrayBuffer().catch(next);
            } catch (e) { /* no Brotli in this browser */ }
          }
        }
        return next();
      });
    };
    return Promise.resolve(next());
  }
  // A HEIF's (HEIC's, AVIF's) Exif item, from where the file's index says it is.
  function heifExif(f, head) {
    var r = HDR && HDR.exifRanges ? HDR.exifRanges(head) : null;
    return r ? new Blob(r.map(function (x) { return f.slice(x[0], x[1]); })).arrayBuffer() : Promise.resolve(null);
  }
  // A file's camera details and HDR flag. HEIF and JPEG XL: from the Exif block their
  // structure points to (a 4-byte offset, then TIFF). Otherwise, or when that fails: found
  // in the head, or the tail where a format keeps EXIF at the end.
  function readFileExif(f) {
    var HEAD = 524288, TAIL = 1048576;
    return f.slice(0, HEAD).arrayBuffer().then(function (buf) {
      var hdr = detectHdr(buf), u8 = new Uint8Array(buf);
      var own = (u8.length >= 12 && isJxl(u8) ? jxlExif(f) : heifExif(f, buf)).catch(function () { return null; });
      return own.then(function (b) {
        if (b && b.byteLength > 8) {
          var x0 = readExifInfo(b, 4 + new DataView(b).getUint32(0));
          if (x0.found) return { exif: x0, hdr: hdr };
        }
        var x = readExifInfo(buf);
        if (x.found || f.size <= HEAD) return { exif: x, hdr: hdr };
        return f.slice(Math.max(HEAD, f.size - TAIL)).arrayBuffer().then(function (tail) {
          return { exif: readExifInfo(tail), hdr: hdr };
        });
      });
    }).catch(function () { return { exif: readExifInfo(new ArrayBuffer(0)), hdr: false }; });
  }
  function exifOf(x) {
    return x.summary ? { camera: x.camera, lens: x.lens, focal: x.focal, aperture: x.aperture, shutter: x.shutter, iso: x.iso } : null;
  }
  function exifLine(e) {
    return e ? [e.camera, e.lens, e.focal, e.aperture, e.shutter, e.iso].filter(Boolean).join(" · ") : "";
  }

  // The town a photo was taken in, for its Place field: the coordinates, rounded to about
  // a kilometre, are looked up on OpenStreetMap. "Boston, MA" in the US, "Kyoto, Japan" elsewhere.
  var placeCache = {};
  function placeFor(lat, lon) {
    if (lat == null || lon == null) return Promise.resolve("");
    var key = lat.toFixed(2) + "," + lon.toFixed(2);
    if (placeCache[key]) return placeCache[key];
    var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=en&lat=" +
      lat.toFixed(2) + "&lon=" + lon.toFixed(2);
    var ask = fetch(url, { headers: { "Accept": "application/json" } }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      var a = (j && j.address) || {};
      var name = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || "";
      if (a.country_code === "us") {
        var st = String(a["ISO3166-2-lvl4"] || "").replace(/^US-/, "");
        return name ? name + (st ? ", " + st : "") : (a.state || "");
      }
      return [name, a.country].filter(Boolean).join(", ");
    }).catch(function () { return ""; });
    // never hold a photo up for long
    placeCache[key] = Promise.race([ask, new Promise(function (r) { setTimeout(function () { r(""); }, 6000); })]);
    return placeCache[key];
  }

  // Prepare one photo at a time to keep memory low with large originals.
  var processing = false;
  function processPending() {
    if (processing) return;
    var item = queue.filter(function (q) { return q.status === "preparing"; })[0];
    if (!item) return;
    processing = true;
    if (item.preview) { URL.revokeObjectURL(item.preview); item.preview = null; }
    item.note = "";
    var headP = readFileExif(item.file);
    var placeP = headP.then(function (h) {
      return settings.place && !item.place && !item.placeTried ? placeFor(h.exif.lat, h.exif.lon) : "";
    });
    Promise.all([prepare(item), headP, placeP]).then(function (r) {
      var x = r[1].exif;
      if (!item.year && x.year) item.year = x.year;
      item.date = x.date;
      item.taken = x.taken;
      item.placeTried = true;
      if (!item.place && r[2]) { item.place = r[2]; item.placeAuto = true; }
      item.exif = exifOf(x);
      item.camera = x.summary;
      item.hdr = r[1].hdr;
      item.status = "ready";
    }, function () {
      item.status = "error";
    }).then(function () {
      processing = false;
      if (queue.indexOf(item) >= 0) renderItem(item);
      updatePublish();
      processPending();
      return checkDuplicate(item);
    });
  }

  function renderItem(item) {
    var li = queueList.querySelector('[data-key="' + item.key + '"]');
    if (!li) {
      li = document.createElement("li");
      li.className = "queue__item";
      li.setAttribute("data-key", item.key);
      queueList.appendChild(li);
    }
    li.innerHTML = "";
    var frame = document.createElement("div");
    frame.className = "queue__preview";
    if (item.preview) {
      var im = document.createElement("img");
      im.src = item.preview; im.alt = ""; im.width = item.w; im.height = item.h;
      frame.appendChild(im);
    } else {
      frame.textContent = item.status === "error" ? "Can't read" : "Preparing…";
    }
    li.appendChild(frame);

    var body = document.createElement("div");
    body.className = "queue__body";
    var meta = document.createElement("p");
    meta.className = "queue__meta";
    if (item.status === "error") {
      meta.textContent = item.name + ": this browser can't read it. For HEIC or HDR photos, use Safari, or export the photo as JPEG.";
      meta.classList.add("is-error");
    } else if (item.status === "ready") {
      meta.textContent = item.name + " → " + item.w + " × " + item.h + ", " + kb(item.full.length) + " (from " + kb(item.file.size) + "). Location and camera data removed." +
        (item.hdrKept ? (item.hdrSource === "pq" || item.hdrSource === "hlg"
            ? " HDR photo (" + item.hdrSource.toUpperCase() + "): kept in HDR as a JPEG with a gain map, made from its full brightness. It glows on HDR screens in Safari, Chrome and Edge, and shows as a normal photo elsewhere."
            : " HDR photo: kept in HDR, with its gain map. It glows on HDR screens in Safari, Chrome and Edge, and shows as a normal photo elsewhere.")
          : item.hdrSource ? " HDR photo (" + item.hdrSource.toUpperCase() + "), but nothing in it is brighter than white, so it is published as a standard image."
          : item.hdr ? " HDR photo: this browser couldn't read its HDR, so it is published as a standard image" + (COLOR_SPACE === "display-p3" ? " that keeps its wide colour" : "") + "." + (item.hdrProblem ? " (Why: " + item.hdrProblem + ")" : "") : "") +
        (settings.camera ? (item.camera ? " Camera details: " + item.camera + "." : " No camera details found in this file.") : "") +
        (item.taken ? " Taken " + item.taken.replace("T", " ").slice(0, 16) + "." : " No date taken in this file, so it goes by its year" + (item.year ? "" : " (none yet: type one)") + ".") +
        (item.placeAuto ? " Place from where it was taken: " + item.place + "." : "");
    } else {
      meta.textContent = item.name + " · " + (item.note || "preparing…");
    }
    body.appendChild(meta);

    if (item.status !== "error") {
      var fields = document.createElement("div");
      fields.className = "queue__fields";
      [["title", "Title", "e.g. Charles River at dusk"], ["place", "Place", "e.g. Boston"], ["year", "Year", String(YEAR)]].forEach(function (f) {
        var label = document.createElement("label"); label.className = "field";
        var span = document.createElement("span"); span.className = "field__label"; span.textContent = f[1];
        var input = document.createElement("input");
        input.type = "text"; input.value = item[f[0]] || ""; input.placeholder = f[2];
        input.id = "q-" + item.key + "-" + f[0];
        if (f[0] === "year") { input.inputMode = "numeric"; input.maxLength = 4; }
        input.addEventListener("input", function () { item[f[0]] = input.value.trim(); if (f[0] === "place") item.placeAuto = false; });
        label.appendChild(span); label.appendChild(input); fields.appendChild(label);
      });
      // this photo's size and quality: as in the settings, or one of a few steps
      var ql = document.createElement("label"); ql.className = "field";
      var qs = document.createElement("span"); qs.className = "field__label"; qs.textContent = "Quality";
      var sel = document.createElement("select");
      sel.id = "q-" + item.key + "-quality";
      [["", "As in settings (" + settings.edge + " px, " + settings.quality + ")"]].concat(QUALITY.map(function (q) { return [q.key, q.label]; }))
        .forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); });
      sel.value = item.qkey || "";
      sel.disabled = busy || item.status !== "ready";
      sel.addEventListener("change", function () {
        var q = QUALITY.filter(function (x) { return x.key === sel.value; })[0];
        item.qkey = q ? q.key : "";
        item.edge = q ? q.edge : 0;
        item.quality = q ? q.quality : 0;
        item.status = "preparing";
        renderItem(item);
        updatePublish();
        processPending();
      });
      ql.appendChild(qs); ql.appendChild(sel); fields.appendChild(ql);
      body.appendChild(fields);
    }
    if (item.status === "ready" && item.dup) {
      var dupNote = document.createElement("p");
      dupNote.className = "queue__dup";
      dupNote.textContent = item.dup + (item.keep ? " It will be published anyway." : " It won't be published again.");
      body.appendChild(dupNote);
      var keep = document.createElement("button");
      keep.type = "button"; keep.className = "btn btn--line btn--small";
      keep.textContent = item.keep ? "Don't publish it" : "Publish anyway";
      keep.disabled = busy;
      keep.addEventListener("click", function () { item.keep = !item.keep; renderItem(item); updatePublish(); });
      body.appendChild(keep);
    }
    var remove = document.createElement("button");
    remove.type = "button"; remove.className = "btn btn--line btn--small"; remove.textContent = "Remove";
    remove.disabled = busy;
    remove.addEventListener("click", function () {
      if (item.preview) URL.revokeObjectURL(item.preview);
      queue = queue.filter(function (q) { return q !== item; });
      li.remove(); updatePublish();
    });
    body.appendChild(remove);
    li.appendChild(body);
  }

  function willPublish(q) { return q.status === "ready" && (!q.dup || q.keep); }
  function updatePublish() {
    var ready = queue.filter(willPublish).length;
    var waiting = queue.filter(function (q) { return q.status === "preparing"; }).length;
    publishBtn.disabled = busy || !token || !ready || waiting > 0;
    publishBtn.textContent = ready ? "Publish " + ready + " photo" + (ready === 1 ? "" : "s") : "Publish";
    if (!token && ready) setStatus(publishStatus, "Sign in (step 1) to publish.");
    else if (waiting) setStatus(publishStatus, "Preparing " + waiting + " photo" + (waiting === 1 ? "" : "s") + "…");
    else if (publishStatus.getAttribute("data-kind") !== "done" && publishStatus.getAttribute("data-kind") !== "error") setStatus(publishStatus, "");
  }

  function setStatus(el, text, kind) {
    el.textContent = text || "";
    if (kind) el.setAttribute("data-kind", kind); else el.removeAttribute("data-kind");
  }

  // ---------- publishing ----------
  function commitChanges(message, makeChanges) {
    var headSha;
    return gh(repoPath() + "/git/ref/heads/" + BRANCH).then(function (ref) {
      headSha = ref.object.sha;
      return gh(repoPath() + "/git/commits/" + headSha);
    }).then(function (commit) {
      return makeChanges().then(function (tree) {
        return gh(repoPath() + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree: tree }) });
      });
    }).then(function (tree) {
      return gh(repoPath() + "/git/commits", { method: "POST", body: JSON.stringify({ message: message, tree: tree.sha, parents: [headSha] }) });
    }).then(function (c) {
      return gh(repoPath() + "/git/refs/heads/" + BRANCH, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
    });
  }

  function publish() {
    var items = queue.filter(willPublish);
    if (!items.length || !token) return;
    busy = true; updatePublish();
    queueList.querySelectorAll("button, input").forEach(function (el) { el.disabled = true; });
    setStatus(publishStatus, "Uploading " + items.length + " photo" + (items.length === 1 ? "" : "s") + "…");
    var added = today();
    var entries = items.map(function (it) {
      var id = newId(it.title || it.name.replace(/\.[^.]+$/, ""));
      it.id = id;
      return { id: id, src: "/" + IMG_DIR + id + ".jpg", thumb: "/" + IMG_DIR + id + "-thumb.jpg", w: it.w, h: it.h,
               title: it.title || "", place: it.place || "", year: /^\d{4}$/.test(it.year || "") ? it.year : "",
               taken: it.taken || undefined, exif: settings.camera ? (it.exif || null) : null, added: added };
    });
    var n = items.length, nextPublished = null;
    commitChanges("Add " + n + " photo" + (n === 1 ? "" : "s") + " to the gallery", function () {
      var tree = [];
      var chain = Promise.resolve();
      items.forEach(function (it, i) {
        chain = chain.then(function () {
          setStatus(publishStatus, "Uploading photo " + (i + 1) + " of " + n + "…");
          return Promise.all([
            gh(repoPath() + "/git/blobs", { method: "POST", body: JSON.stringify({ content: bytesToBase64(it.full), encoding: "base64" }) }),
            gh(repoPath() + "/git/blobs", { method: "POST", body: JSON.stringify({ content: bytesToBase64(it.thumb), encoding: "base64" }) })
          ]).then(function (b) {
            tree.push({ path: IMG_DIR + it.id + ".jpg", mode: "100644", type: "blob", sha: b[0].sha });
            tree.push({ path: IMG_DIR + it.id + "-thumb.jpg", mode: "100644", type: "blob", sha: b[1].sha });
          });
        });
      });
      return chain.then(fetchGallery).then(function (g) {
        setStatus(publishStatus, "Updating the gallery…");
        nextPublished = entries.concat(g.entries);
        tree.push({ path: DATA_PATH, mode: "100644", type: "blob", content: serializeGallery(g.header, nextPublished) });
        return tree;
      });
    }).then(function () {
      items.forEach(function (it, i) { entries[i].localPreview = it.preview; entries[i].print = it.print; });
      published = byTaken(nextPublished);
      queue = queue.filter(function (q) { return items.indexOf(q) < 0; });
      queueList.querySelectorAll(".queue__item").forEach(function (li) {
        if (!queue.some(function (q) { return q.key === li.getAttribute("data-key"); })) li.remove();
      });
      busy = false;
      setStatus(publishStatus, "Published " + n + " photo" + (n === 1 ? "" : "s") + ". Your gallery updates in about a minute.", "done");
      renderPublished();
      updatePublish();
    }).catch(function (err) {
      busy = false;
      queueList.querySelectorAll("button, input").forEach(function (el) { el.disabled = false; });
      setStatus(publishStatus, explain(err, "publish to"), "error");
      updatePublish();
    });
  }

  function removePhoto(entry, li) {
    busy = true; updatePublish();
    li.classList.add("is-busy");
    var rest = null;
    commitChanges("Remove a photo from the gallery", function () {
      return fetchGallery().then(function (g) {
        rest = g.entries.filter(function (e) { return e.id !== entry.id; });
        return [
          { path: entry.src.replace(/^\//, ""), mode: "100644", type: "blob", sha: null },
          { path: entry.thumb.replace(/^\//, ""), mode: "100644", type: "blob", sha: null },
          { path: DATA_PATH, mode: "100644", type: "blob", content: serializeGallery(g.header, rest) }
        ];
      });
    }).then(function () {
      busy = false;
      published = rest;
      renderPublished();
      setStatus(publishStatus, "Removed. Your gallery updates in about a minute.", "done");
      updatePublish();
    }).catch(function (err) {
      busy = false;
      li.classList.remove("is-busy");
      setStatus(publishStatus, explain(err, "change"), "error");
      updatePublish();
    });
  }

  // Camera details for a photo already published (one added before the studio read them):
  // its original is read here, on this device; only the details go into the gallery list.
  function addCameraDetails(entry, li, file) {
    if (busy) return;
    busy = true; updatePublish();
    li.classList.add("is-busy");
    setStatus(publishStatus, "Reading the camera details…");
    var details = null, year = "", taken = "", place = "", next = null;
    readFileExif(file).then(function (r) {
      details = exifOf(r.exif);
      year = r.exif.year || "";
      taken = r.exif.taken || "";
      if (!details) {
        var e0 = new Error("no camera details"); e0.noDetails = true; throw e0;
      }
      return settings.place && !entry.place ? placeFor(r.exif.lat, r.exif.lon) : "";
    }).then(function (pl) {
      place = pl || "";
      setStatus(publishStatus, "Saving the camera details…");
      return commitChanges("Add camera details to a photo", function () {
        return fetchGallery().then(function (g) {
          next = g.entries.map(function (e) {
            if (e.id !== entry.id) return e;
            var u = Object.assign({}, e, { exif: details });
            if (!/^\d{4}$/.test(u.year || "") && /^\d{4}$/.test(year)) u.year = year;
            if (taken) u.taken = taken;
            if (!u.place && place) u.place = place;
            return u;
          });
          return [{ path: DATA_PATH, mode: "100644", type: "blob", content: serializeGallery(g.header, next) }];
        });
      });
    }).then(function () {
      busy = false;
      published = byTaken(next);
      renderPublished();
      setStatus(publishStatus, "Camera details added: " + exifLine(details) + (place ? ". Place: " + place : "") + ". Your gallery updates in about a minute.", "done");
      updatePublish();
    }).catch(function (err) {
      busy = false;
      li.classList.remove("is-busy");
      if (err && err.noDetails) setStatus(publishStatus, "That file has no camera details. Choose the original from the camera or from Photos (not an exported or shared copy).", "error");
      else setStatus(publishStatus, explain(err, "change"), "error");
      updatePublish();
    });
  }

  // ---------- when photos already published were taken ----------
  // For photos published before the studio kept when they were taken: their originals,
  // chosen all at once, are matched to them by file name (each photo's id is made from its
  // file's name), and only when each was taken is read, here on this device. One change
  // saves them all, and the gallery takes the order they were taken in.
  function idStem(id) { return String(id || "").replace(/^\d{8}-/, "").replace(/-[a-z0-9]{4}$/, ""); }
  function renderDates() {
    var missing = published.filter(function (e) { return !e.taken; }).length;
    datesBox.hidden = !token || !published.length;
    datesInfo.textContent = missing
      ? missing + " of your " + published.length + " published photo" + (published.length === 1 ? " has" : "s have") + " no date taken yet, so " + (missing === 1 ? "it goes" : "they go") + " by year. Choose their originals (all at once is fine): each is matched to its photo by file name, and only when it was taken is read, on this device, and saved."
      : "Every published photo has its date taken: the gallery is in the order they were taken, the newest first.";
    datesBtn.disabled = busy;
  }
  function addDatesTaken(files) {
    if (busy || !token || !files.length) return;
    var stems = {};
    published.forEach(function (e) { var k = idStem(e.id); (stems[k] = stems[k] || []).push(e.id); });
    var jobs = [], unmatched = 0;
    Array.prototype.forEach.call(files, function (f) {
      var ids = stems[slugify(f.name.replace(/\.[^.]+$/, ""))];
      if (ids) jobs.push({ f: f, ids: ids }); else unmatched++;
    });
    if (!jobs.length) {
      setStatus(datesStatus, "None of these files has the name of a published photo. Choose the originals the photos were published from.", "error");
      return;
    }
    busy = true; updatePublish(); renderDates();
    var found = {}, undated = 0, done = 0, next = null, n = 0;
    var chain = Promise.resolve();
    jobs.forEach(function (j) {
      chain = chain.then(function () {
        setStatus(datesStatus, "Reading " + (++done) + " of " + jobs.length + "…");
        return readFileExif(j.f).then(function (r) {
          var x = r.exif;
          if (!x.taken) { undated++; return; }
          j.ids.forEach(function (id) { found[id] = { taken: x.taken, year: x.year, exif: exifOf(x) }; });
        });
      });
    });
    chain.then(function () {
      n = Object.keys(found).length;
      if (!n) { var e0 = new Error("no dates"); e0.noDates = true; throw e0; }
      setStatus(datesStatus, "Saving " + n + " date" + (n === 1 ? "" : "s") + " taken…");
      return commitChanges("Add when " + n + " photo" + (n === 1 ? " was" : "s were") + " taken", function () {
        return fetchGallery().then(function (g) {
          next = g.entries.map(function (e) {
            var d = found[e.id];
            if (!d) return e;
            var u = Object.assign({}, e, { taken: d.taken });
            if (!/^\d{4}$/.test(u.year || "") && d.year) u.year = d.year;
            if (!u.exif && d.exif && settings.camera) u.exif = d.exif;
            return u;
          });
          return [{ path: DATA_PATH, mode: "100644", type: "blob", content: serializeGallery(g.header, next) }];
        });
      });
    }).then(function () {
      busy = false;
      published = byTaken(next);
      renderPublished(); updatePublish();
      var notes = [];
      if (undated) notes.push(undated + " had no date taken in it");
      if (unmatched) notes.push(unmatched + " matched no published photo");
      setStatus(datesStatus, "Saved when " + n + " photo" + (n === 1 ? " was" : "s were") + " taken" + (notes.length ? " (" + notes.join("; ") + ")" : "") + ". The gallery is now in that order; it updates in about a minute.", "done");
    }).catch(function (err) {
      busy = false;
      renderDates(); updatePublish();
      if (err && err.noDates) setStatus(datesStatus, "None of the matching files has a date taken in it. Choose the originals from the camera or from Photos (not an exported or shared copy).", "error");
      else setStatus(datesStatus, explain(err, "change"), "error");
    });
  }

  // ---------- every photo at once ----------
  // Deletes every published photo, its picture files and its line in the gallery list, in
  // one change: to publish them all again from the start. Two clicks, the second within a
  // few seconds, naming how many go.
  var allArmed = false, allTimer = 0;
  function renderDeleteAll() {
    deleteAllBox.hidden = !token || !published.length;
    clearTimeout(allTimer);
    allArmed = false;
    deleteAllBtn.classList.remove("is-armed");
    deleteAllBtn.textContent = "Delete all " + published.length + " photo" + (published.length === 1 ? "" : "s");
    deleteAllBtn.disabled = busy;
  }
  function deleteAll() {
    if (busy || !token || !published.length) return;
    if (!allArmed) {
      allArmed = true;
      deleteAllBtn.classList.add("is-armed");
      deleteAllBtn.textContent = "Confirm: delete all " + published.length + " photo" + (published.length === 1 ? "" : "s");
      setStatus(deleteAllStatus, "This removes every photo from your gallery. Click again within 5 seconds to confirm.");
      allTimer = setTimeout(function () { renderDeleteAll(); setStatus(deleteAllStatus, ""); }, 5000);
      return;
    }
    clearTimeout(allTimer);
    busy = true; updatePublish();
    deleteAllBtn.disabled = true;
    datesBtn.disabled = true;
    pubList.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    setStatus(deleteAllStatus, "Deleting every photo…");
    var n = 0;
    commitChanges("Remove all photos from the gallery", function () {
      // the gallery list as it is now, and the picture files there really are
      return Promise.all([fetchGallery(), gh(repoPath() + "/contents/" + IMG_DIR.replace(/\/$/, "") + "?ref=" + encodeURIComponent(BRANCH)).catch(function () { return null; })]).then(function (r) {
        var g = r[0], have = {};
        // (the folder could not be listed: every file the list names is taken to be there)
        if (Array.isArray(r[1])) r[1].forEach(function (f) { if (f && f.path) have[f.path] = true; });
        else g.entries.forEach(function (e) { [e.src, e.thumb].forEach(function (x) { if (x) have[String(x).replace(/^\//, "")] = true; }); });
        n = g.entries.length;
        var tree = [];
        g.entries.forEach(function (e) {
          [e.src, e.thumb].forEach(function (src) {
            var path = String(src || "").replace(/^\//, "");
            if (path.indexOf(IMG_DIR) === 0 && have[path]) { tree.push({ path: path, mode: "100644", type: "blob", sha: null }); delete have[path]; }
          });
        });
        tree.push({ path: DATA_PATH, mode: "100644", type: "blob", content: serializeGallery(g.header, []) });
        return tree;
      });
    }).then(function () {
      busy = false;
      published = [];
      renderPublished(); updatePublish();
      setStatus(deleteAllStatus, "Deleted all " + n + " photo" + (n === 1 ? "" : "s") + ". Your gallery is empty until you publish again; it updates in about a minute.", "done");
    }).catch(function (err) {
      busy = false;
      renderPublished(); updatePublish();
      setStatus(deleteAllStatus, explain(err, "change"), "error");
    });
  }

  function renderPublished() {
    renderDates();
    renderDeleteAll();
    pubList.innerHTML = "";
    pubEmpty.hidden = published.length > 0;
    if (!published.length) pubEmpty.textContent = token ? "No photos yet. Add some above." : "Sign in to see the photos already in your gallery.";
    published.forEach(function (e) {
      var li = document.createElement("li");
      li.className = "pubs__item";
      var frame = document.createElement("div");
      frame.className = "pubs__thumb";
      var im = document.createElement("img");
      im.alt = e.title || "Photograph"; im.loading = "lazy";
      im.src = e.localPreview || e.thumb;
      im.onerror = function () { frame.textContent = "Publishing…"; };
      frame.appendChild(im);
      var text = document.createElement("p");
      text.className = "pubs__text";
      text.textContent = (e.title || "Untitled") + (e.place || e.year ? " · " + [e.place, e.year].filter(Boolean).join(", ") : "");
      if (e.exif) {
        var spec = document.createElement("span");
        spec.className = "pubs__spec";
        spec.textContent = exifLine(e.exif);
        text.appendChild(spec);
      }
      // the original, to read its camera details from
      var pick = document.createElement("input");
      pick.type = "file";
      pick.accept = "image/*,.heic,.heif,.avif,.jxl,.dng";
      pick.hidden = true;
      var cam = document.createElement("button");
      cam.type = "button"; cam.className = "btn btn--line btn--small";
      cam.textContent = e.exif ? "Update camera details" : "Add camera details";
      cam.title = "Choose this photo's original; its camera, lens and settings are read on this device";
      cam.addEventListener("click", function () { if (!busy) pick.click(); });
      pick.addEventListener("change", function () {
        var f = pick.files && pick.files[0];
        pick.value = "";
        if (f) addCameraDetails(e, li, f);
      });
      var del = document.createElement("button");
      del.type = "button"; del.className = "btn btn--line btn--small"; del.textContent = "Delete";
      var armed = false, timer = 0;
      del.addEventListener("click", function () {
        if (busy) return;
        if (!armed) {
          armed = true; del.textContent = "Confirm delete"; del.classList.add("is-armed");
          timer = setTimeout(function () { armed = false; del.textContent = "Delete"; del.classList.remove("is-armed"); }, 4000);
          return;
        }
        clearTimeout(timer);
        removePhoto(e, li);
      });
      li.appendChild(frame); li.appendChild(text); li.appendChild(cam); li.appendChild(pick); li.appendChild(del);
      pubList.appendChild(li);
    });
  }

  // ---------- connect ----------
  function connect(t, remember, quiet) {
    token = t;
    if (!quiet) setStatus(connectStatus, "Checking…");
    return gh(repoPath()).then(function (repo) {
      if (repo && repo.permissions && repo.permissions.push === false) {
        var e = new Error("read-only"); e.status = 403; e.readOnly = true; throw e;
      }
      // Prove the token can write: a tiny unreferenced blob changes nothing on the site.
      return gh(repoPath() + "/git/blobs", { method: "POST", body: JSON.stringify({ content: "gallery-studio write check", encoding: "utf-8" }) })
        .catch(function (err) {
          if (err.status === 403 || err.status === 404) { var e2 = new Error("read-only"); e2.status = 403; e2.readOnly = true; throw e2; }
          throw err;
        });
    }).then(fetchGallery).then(function (g) {
      if (remember !== null) writeToken(t, remember);
      try { localStorage.setItem(OWNER_KEY, "1"); } catch (e) {}
      published = g.entries;
      queue.forEach(function (q) { checkDuplicate(q); });
      connectForm.hidden = true; connectedBox.hidden = false;
      connectedText.textContent = "Signed in.";
      setStatus(connectStatus, "");
      tokenInput.value = "";
      renderPublished(); updatePublish();
    }).catch(function (err) {
      token = null;
      if (quiet) forgetToken();
      setStatus(connectStatus, explain(err, "read"), "error");
      renderPublished(); updatePublish();
    });
  }

  connectBtn.addEventListener("click", function () {
    var t = tokenInput.value.trim();
    if (!t) { setStatus(connectStatus, "Enter your password first.", "error"); tokenInput.focus(); return; }
    connect(t, rememberBox.checked, false);
  });
  tokenInput.addEventListener("keydown", function (e) { if (e.key === "Enter") connectBtn.click(); });
  disconnectBtn.addEventListener("click", function () {
    token = null; forgetToken(); published = [];
    try { localStorage.removeItem(OWNER_KEY); } catch (e) {}
    connectForm.hidden = false; connectedBox.hidden = true;
    renderPublished(); updatePublish();
    setStatus(connectStatus, "Signed out. The password was removed from this browser.");
  });

  // ---------- file input and drag-and-drop ----------
  filesInput.addEventListener("change", function () { addFiles(filesInput.files); filesInput.value = ""; });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
  });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  datesBtn.addEventListener("click", function () { if (!busy) datesInput.click(); });
  deleteAllBtn.addEventListener("click", deleteAll);
  datesInput.addEventListener("change", function () {
    var list = datesInput.files ? Array.prototype.slice.call(datesInput.files) : [];
    datesInput.value = "";
    addDatesTaken(list);
  });
  publishBtn.addEventListener("click", publish);
  // ---------- settings ----------
  function loadSettings() {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    try {
      var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      for (k in DEFAULTS) if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) out[k] = saved[k];
    } catch (e) {}
    return out;
  }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }
  var F = {
    edge: $("s-edge"), quality: $("s-quality"), qualityOut: $("s-quality-out"),
    wmText: $("s-wm-text"), wmPos: $("s-wm-pos"), wmSize: $("s-wm-size"), wmOpacity: $("s-wm-op"), wmOpacityOut: $("s-wm-op-out"),
    copyright: $("s-copyright"), artist: $("s-artist"), camera: $("s-camera"), place: $("s-place"), reset: $("s-reset"),
    summary: $("settings-summary"), lede: $("studio-lede")
  };
  var POS = { br: "bottom right", bl: "bottom left", tr: "top right", tl: "top left", c: "centre" };
  var SIZE = { s: "small", m: "medium", l: "large" };
  function fillForm() {
    F.edge.value = String(settings.edge);
    F.quality.value = settings.quality; F.qualityOut.textContent = settings.quality;
    watermarkBox.checked = settings.wmOn;
    F.wmText.value = settings.wmText; F.wmPos.value = settings.wmPos; F.wmSize.value = settings.wmSize;
    F.wmOpacity.value = settings.wmOpacity; F.wmOpacityOut.textContent = settings.wmOpacity + "%";
    F.copyright.value = settings.copyright; F.artist.value = settings.artist; F.camera.checked = settings.camera; F.place.checked = settings.place;
    [F.wmText, F.wmPos, F.wmSize, F.wmOpacity].forEach(function (el) { el.disabled = !settings.wmOn; });
  }
  function describe() {
    var hasWm = settings.wmOn && settings.wmText.trim();
    var wm = hasWm ? "a " + SIZE[settings.wmSize] + " watermark at the " + POS[settings.wmPos] + " (" + settings.wmOpacity + "% opacity)" : "no watermark";
    F.summary.textContent = "Publishing at " + settings.edge + " px, JPEG quality " + settings.quality + ", with " + wm + ". " +
      "Location and camera data are always removed from the files" + (settings.camera ? "; camera and lens appear in captions." : ".");
    F.lede.textContent = "";
    F.lede.appendChild(document.createTextNode("Add photographs to "));
    var a = document.createElement("a"); a.href = F.lede.getAttribute("data-gallery"); a.textContent = "your gallery";
    F.lede.appendChild(a);
    F.lede.appendChild(document.createTextNode(". In this browser, each photo is resized to " + settings.edge +
      " px on its long edge, cleared of location and camera data, stamped with your copyright" +
      (hasWm ? ", and watermarked" : "") + ". HDR photos keep their HDR. Only those copies are published; your originals never leave this device."));
  }
  var reprocessTimer = 0;
  function reprocessQueued() {
    clearTimeout(reprocessTimer);
    reprocessTimer = setTimeout(function () {
      queue.forEach(function (q) { if (q.status === "ready") { q.status = "preparing"; renderItem(q); } });
      updatePublish();
      processPending();
    }, 350);
  }
  function readForm(affectsImages) {
    var edge = parseInt(F.edge.value, 10);
    settings.edge = [1600, 2000, 2400, 3000, 4000].indexOf(edge) >= 0 ? edge : DEFAULTS.edge;
    settings.quality = Math.min(95, Math.max(70, parseInt(F.quality.value, 10) || DEFAULTS.quality));
    settings.wmOn = watermarkBox.checked;
    settings.wmText = F.wmText.value.slice(0, 80);
    settings.wmPos = POS[F.wmPos.value] ? F.wmPos.value : "br";
    settings.wmSize = SIZE[F.wmSize.value] ? F.wmSize.value : "s";
    settings.wmOpacity = Math.min(90, Math.max(20, parseInt(F.wmOpacity.value, 10) || DEFAULTS.wmOpacity));
    settings.copyright = F.copyright.value.slice(0, 200);
    settings.artist = F.artist.value.slice(0, 120);
    settings.camera = F.camera.checked;
    settings.place = F.place.checked;
    F.qualityOut.textContent = settings.quality;
    F.wmOpacityOut.textContent = settings.wmOpacity + "%";
    [F.wmText, F.wmPos, F.wmSize, F.wmOpacity].forEach(function (el) { el.disabled = !settings.wmOn; });
    saveSettings(); describe();
    if (affectsImages) reprocessQueued();
    else queue.forEach(function (q) { if (q.status === "ready") renderItem(q); });
  }
  [watermarkBox, F.edge, F.wmPos, F.wmSize].forEach(function (el) { el.addEventListener("change", function () { readForm(true); }); });
  [F.quality, F.wmOpacity, F.wmText, F.copyright, F.artist].forEach(function (el) { el.addEventListener("input", function () { readForm(true); }); });
  F.camera.addEventListener("change", function () { readForm(false); });
  F.place.addEventListener("change", function () { readForm(false); });
  F.reset.addEventListener("click", function () {
    var k; for (k in DEFAULTS) settings[k] = DEFAULTS[k];
    fillForm(); saveSettings(); describe(); reprocessQueued();
  });
  window.addEventListener("beforeunload", function (e) {
    if (busy) { e.preventDefault(); e.returnValue = ""; }
  });

  // Exposed for automated checks only; does nothing on its own.
  window.__galleryStudio = { titleFromName: titleFromName, colorSpace: COLOR_SPACE, detectHdr: detectHdr, exifSegment: exifSegment, insertSegment: insertSegment, readExifYear: readExifYear, readExifInfo: readExifInfo, readFileExif: readFileExif, fingerprintOf: fingerprintOf, fpDistance: fpDistance, settings: function () { return settings; }, parseGallery: parseGallery, serializeGallery: serializeGallery };

  // ---------- start ----------
  fillForm(); describe();
  var saved = readToken();
  if (saved) connect(saved, null, true); else { renderPublished(); updatePublish(); }
})();
