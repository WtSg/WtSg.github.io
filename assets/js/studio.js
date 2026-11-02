/*
 * Gallery Studio
 * Prepares photos in the browser and publishes them to the site's GitHub repository.
 *
 * For each photo:
 *   - decode (EXIF orientation applied) and resize to <= 2000px on the long edge,
 *     plus a <= 900px thumbnail;
 *   - re-encode as JPEG, which drops every original metadata block (GPS included);
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
  var MAX_EDGE = 2000;
  var THUMB_EDGE = 900;
  var QUALITY = 0.86;
  var THUMB_QUALITY = 0.82;
  var DATA_PATH = "_data/gallery.yml";
  var IMG_DIR = "img/gallery/";
  var TOKEN_KEY = "gallery-studio-token";

  var $ = function (id) { return document.getElementById(id); };
  var tokenInput = $("token"), rememberBox = $("remember"), connectBtn = $("connect");
  var connectForm = $("connect-form"), connectedBox = $("connected"), connectedText = $("connected-text");
  var connectStatus = $("connect-status"), disconnectBtn = $("disconnect");
  var filesInput = $("files"), drop = $("drop"), watermarkBox = $("watermark");
  var queueList = $("queue"), publishBtn = $("publish"), publishStatus = $("publish-status");
  var pubList = $("pub-list"), pubEmpty = $("pub-empty");

  var token = null;
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
    if (s === 401) return "GitHub didn't accept the token. Check that it was copied in full and hasn't expired, then connect again.";
    if (s === 403 || s === 404) return "The token can't " + action + " WtSg/WtSg.github.io. Give it access to that repository with Contents set to Read and write.";
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
    "# Photography gallery, newest first.",
    "# Written by the Gallery Studio (www.wshangguan.com/studio/): one photo per line.",
    "# Each line is a YAML flow mapping with id, src, thumb, w, h, title, place, year, added.",
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
  function serializeGallery(header, entries) {
    var lines = header.slice();
    entries.forEach(function (e) {
      lines.push("- " + JSON.stringify({
        id: e.id, src: e.src, thumb: e.thumb, w: e.w, h: e.h,
        title: e.title || "", place: e.place || "", year: e.year || "", added: e.added || ""
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

  // ---------- EXIF: read the capture year; write Artist + Copyright ----------
  function readExifYear(buf) {
    try {
      var v = new DataView(buf);
      if (v.getUint16(0) !== 0xFFD8) return "";
      var off = 2;
      while (off + 4 < v.byteLength) {
        var marker = v.getUint16(off), len = v.getUint16(off + 2);
        if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
          var t = off + 10, little = v.getUint16(t) === 0x4949;
          var u16 = function (p) { return v.getUint16(t + p, little); };
          var u32 = function (p) { return v.getUint32(t + p, little); };
          var findTag = function (ifd, tag) {
            var n = u16(ifd);
            for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (u16(e) === tag) return e; }
            return -1;
          };
          var ifd0 = u32(4), exifPtr = findTag(ifd0, 0x8769);
          var ifd = exifPtr >= 0 ? u32(exifPtr + 8) : -1;
          var e = ifd >= 0 ? findTag(ifd, 0x9003) : -1;          // DateTimeOriginal
          if (e < 0) e = findTag(ifd0, 0x0132);                   // DateTime
          if (e < 0) return "";
          var p = t + u32(e + 8), s = "";
          for (var k = 0; k < 4; k++) s += String.fromCharCode(v.getUint8(p + k));
          return /^\d{4}$/.test(s) && s !== "0000" ? s : "";
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        off += 2 + len;
      }
    } catch (e) {}
    return "";
  }
  function exifSegment(artist, copyright) {
    var enc = function (s) {
      var ascii = s.replace(/[^\x20-\x7E]/g, "");
      var b = new Uint8Array(ascii.length + 1);
      for (var i = 0; i < ascii.length; i++) b[i] = ascii.charCodeAt(i);
      return b;                                                    // NUL-terminated ASCII
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
  function decode(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return decodeWithImg(file); });
    }
    return decodeWithImg(file);
  }
  function decodeWithImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { resolve(im); setTimeout(function () { URL.revokeObjectURL(url); }, 0); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
      im.src = url;
    });
  }
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  // Halve repeatedly, then do the final step, for clean downscaling in every browser.
  function scaleTo(src, sw, sh, w, h) {
    var cur = src, cw = sw, ch = sh;
    while (cw / 2 >= w && ch / 2 >= h) {
      var half = canvas(Math.round(cw / 2), Math.round(ch / 2)), hc = half.getContext("2d");
      hc.imageSmoothingEnabled = true; hc.imageSmoothingQuality = "high";
      hc.drawImage(cur, 0, 0, half.width, half.height);
      cur = half; cw = half.width; ch = half.height;
    }
    var out = canvas(w, h), ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, w, h);
    return out;
  }
  function drawWatermark(c) {
    var ctx = c.getContext("2d"), L = Math.max(c.width, c.height);
    var size = Math.max(11, Math.round(L * 0.0125)), pad = Math.round(L * 0.018);
    ctx.save();
    ctx.font = "400 " + size + "px \"DejaVu Sans\", Verdana, sans-serif";
    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = Math.max(2, Math.round(size * 0.3));
    ctx.shadowOffsetY = Math.max(1, Math.round(size * 0.06));
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("© " + YEAR + " " + AUTHOR, c.width - pad, c.height - pad);
    ctx.restore();
  }
  function toJpegBytes(c, q) {
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) {
        if (!b) return reject(new Error("encode"));
        b.arrayBuffer().then(function (ab) { resolve(new Uint8Array(ab)); }, reject);
      }, "image/jpeg", q);
    });
  }
  var fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load("400 24px \"DejaVu Sans\"").catch(function () {})
    : Promise.resolve();

  function prepare(item) {
    var seg = exifSegment(AUTHOR, "Copyright " + YEAR + " " + AUTHOR + ". All rights reserved.");
    return Promise.all([decode(item.file), fontReady]).then(function (res) {
      var bmp = res[0];
      var sw = bmp.width || bmp.naturalWidth, sh = bmp.height || bmp.naturalHeight;
      var k = Math.min(1, MAX_EDGE / Math.max(sw, sh));
      var w = Math.round(sw * k), h = Math.round(sh * k);
      var full = scaleTo(bmp, sw, sh, w, h);
      if (bmp.close) bmp.close();
      if (watermarkBox.checked) drawWatermark(full);
      var t = Math.min(1, THUMB_EDGE / Math.max(w, h));
      var thumb = scaleTo(full, w, h, Math.round(w * t), Math.round(h * t));
      return Promise.all([toJpegBytes(full, QUALITY), toJpegBytes(thumb, THUMB_QUALITY)]).then(function (out) {
        item.full = insertSegment(out[0], seg);
        item.thumb = insertSegment(out[1], seg);
        item.w = w; item.h = h;
        item.preview = URL.createObjectURL(new Blob([item.thumb], { type: "image/jpeg" }));
      });
    });
  }

  // ---------- naming ----------
  function slugify(s) {
    return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
  }
  function titleFromName(name) {
    var base = name.replace(/\.[^.]+$/, "");
    if (/^(img|dsc|dscf|dscn|pxl|mvimg|_mg|p\d{3}|gopr|dji)[_-]?\d/i.test(base) || /^\d[\d_ -]*$/.test(base)) return "";
    return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function newId(title) {
    var stamp = today().replace(/-/g, ""), rand = Math.random().toString(36).slice(2, 6);
    return stamp + "-" + slugify(title) + "-" + rand;
  }
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  // ---------- queue UI ----------
  function addFiles(list) {
    var files = Array.prototype.filter.call(list, function (f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); });
    if (!files.length) { setStatus(publishStatus, "Those files aren't photos. Choose JPEG, PNG or WebP images.", "error"); return; }
    setStatus(publishStatus, "");
    files.forEach(function (file) {
      var item = { key: Math.random().toString(36).slice(2), file: file, name: file.name, title: titleFromName(file.name), place: "", year: "", status: "preparing" };
      queue.push(item);
      renderItem(item);
    });
    updatePublish();
    processPending();
  }

  // Prepare one photo at a time to keep memory low with large originals.
  var processing = false;
  function processPending() {
    if (processing) return;
    var item = queue.filter(function (q) { return q.status === "preparing"; })[0];
    if (!item) return;
    processing = true;
    if (item.preview) { URL.revokeObjectURL(item.preview); item.preview = null; }
    var yearP = item.year ? Promise.resolve(item.year)
      : item.file.slice(0, 262144).arrayBuffer().then(readExifYear).catch(function () { return ""; });
    Promise.all([prepare(item), yearP]).then(function (r) {
      if (!item.year && r[1]) item.year = r[1];
      item.status = "ready";
    }, function () {
      item.status = "error";
    }).then(function () {
      processing = false;
      if (queue.indexOf(item) >= 0) renderItem(item);
      updatePublish();
      processPending();
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
      meta.textContent = item.name + ": this browser can't read it. For HEIC, use Safari or export the photo as JPEG.";
      meta.classList.add("is-error");
    } else if (item.status === "ready") {
      meta.textContent = item.name + " → " + item.w + " × " + item.h + ", " + kb(item.full.length) + " (from " + kb(item.file.size) + "). Location and camera data removed.";
    } else {
      meta.textContent = item.name + " · preparing…";
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
        input.addEventListener("input", function () { item[f[0]] = input.value.trim(); });
        label.appendChild(span); label.appendChild(input); fields.appendChild(label);
      });
      body.appendChild(fields);
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

  function updatePublish() {
    var ready = queue.filter(function (q) { return q.status === "ready"; }).length;
    var waiting = queue.filter(function (q) { return q.status === "preparing"; }).length;
    publishBtn.disabled = busy || !token || !ready || waiting > 0;
    publishBtn.textContent = ready ? "Publish " + ready + " photo" + (ready === 1 ? "" : "s") : "Publish";
    if (!token && ready) setStatus(publishStatus, "Connect to GitHub (step 1) to publish.");
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
    var items = queue.filter(function (q) { return q.status === "ready"; });
    if (!items.length || !token) return;
    busy = true; updatePublish();
    queueList.querySelectorAll("button, input").forEach(function (el) { el.disabled = true; });
    setStatus(publishStatus, "Uploading " + items.length + " photo" + (items.length === 1 ? "" : "s") + "…");
    var added = today();
    var entries = items.map(function (it) {
      var id = newId(it.title || it.name.replace(/\.[^.]+$/, ""));
      it.id = id;
      return { id: id, src: "/" + IMG_DIR + id + ".jpg", thumb: "/" + IMG_DIR + id + "-thumb.jpg", w: it.w, h: it.h,
               title: it.title || "", place: it.place || "", year: /^\d{4}$/.test(it.year || "") ? it.year : "", added: added };
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
      published = nextPublished;
      items.forEach(function (it, i) { entries[i].localPreview = it.preview; });
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

  function renderPublished() {
    pubList.innerHTML = "";
    pubEmpty.hidden = published.length > 0;
    if (!published.length) pubEmpty.textContent = token ? "No photos yet. Add some above." : "Connect to see the photos already in your gallery.";
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
      li.appendChild(frame); li.appendChild(text); li.appendChild(del);
      pubList.appendChild(li);
    });
  }

  // ---------- connect ----------
  function connect(t, remember, quiet) {
    token = t;
    if (!quiet) setStatus(connectStatus, "Checking the token…");
    return gh(repoPath()).then(function (repo) {
      if (repo && repo.permissions && repo.permissions.push === false) {
        var e = new Error("read-only"); e.status = 403; throw e;
      }
      return fetchGallery();
    }).then(function (g) {
      if (remember !== null) writeToken(t, remember);
      published = g.entries;
      connectForm.hidden = true; connectedBox.hidden = false;
      connectedText.textContent = "Connected to " + OWNER + "/" + REPO + ".";
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
    if (!t) { setStatus(connectStatus, "Paste your token first.", "error"); tokenInput.focus(); return; }
    connect(t, rememberBox.checked, false);
  });
  tokenInput.addEventListener("keydown", function (e) { if (e.key === "Enter") connectBtn.click(); });
  disconnectBtn.addEventListener("click", function () {
    token = null; forgetToken(); published = [];
    connectForm.hidden = false; connectedBox.hidden = true;
    renderPublished(); updatePublish();
    setStatus(connectStatus, "Disconnected. The token was removed from this browser.");
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
  publishBtn.addEventListener("click", publish);
  watermarkBox.addEventListener("change", function () {
    queue.forEach(function (q) { if (q.status === "ready") { q.status = "preparing"; renderItem(q); } });
    updatePublish();
    processPending();
  });
  window.addEventListener("beforeunload", function (e) {
    if (busy) { e.preventDefault(); e.returnValue = ""; }
  });

  // Exposed for automated checks only; does nothing on its own.
  window.__galleryStudio = { exifSegment: exifSegment, insertSegment: insertSegment, readExifYear: readExifYear, parseGallery: parseGallery, serializeGallery: serializeGallery };

  // ---------- start ----------
  var saved = readToken();
  if (saved) connect(saved, null, true); else { renderPublished(); updatePublish(); }
})();
