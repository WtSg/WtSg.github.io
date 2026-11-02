/*
 * Endless canvas, seen through a rangefinder.
 * - The photographs hang on a wall that repeats in every direction. Drag it or
 *   use the arrow keys; it carries on with inertia. Ctrl (or Cmd) + wheel moves
 *   to the next or the previous photograph.
 * - The faster it moves, the further the lens pulls back: a hard swipe shows
 *   the whole wall, a gentle drag stays close.
 * - When it slows, the nearest photograph glides into the bright-line frame
 *   and the lens closes in until it fills it. A portrait photograph turns the
 *   camera: the frame rotates a quarter turn to stand it up.
 * - The focus patch at the centre shows the picture's ghost image, which
 *   slides into register as it settles. The focus lamps point to the picture
 *   coming in, and the dot lights when it is sharp.
 * - The LED readout counts the frame and shows the photograph's real settings
 *   when it has them; its digits roll as the frame changes.
 * - Click (or Enter) fires a focal-plane shutter and opens the photograph.
 * - Zoom: the mouse wheel, a pinch with two fingers or on a trackpad, the - and +
 *   buttons or keys (0 resets). Out, more of the wall shows and the frame lines
 *   close round the photograph; in, the photograph grows past them. It still
 *   comes to rest on the nearest photograph.
 * - Reduced motion: no inertia, speed zoom, turn or shutter; frames change at once.
 */
(function () {
  "use strict";
  var G = window.Gallery;
  var room = document.querySelector(".cv-room");
  var plane = room ? room.querySelector(".cv-plane") : null;
  if (!G || !plane || !G.photos.length) return;

  var root = document.documentElement;
  root.classList.add("cv-on");
  var photos = G.photos, N = photos.length, still = G.still;
  var vf = room.querySelector(".vf");
  var frameEl = vf.querySelector(".vf-frame");
  var maskEl = vf.querySelector(".vf-mask");
  var patch = vf.querySelector(".vf-patch");
  var below = vf.querySelector(".vf-below");
  var capEl = vf.querySelector("[data-vf-caption]");
  var exifEl = vf.querySelector("[data-led-exif]");
  var sLabel = vf.querySelector("[data-led-sl]");
  var shutter = room.querySelector(".vf-shutter");
  var hint = room.querySelector("[data-cv-hint]");
  var foot = document.querySelector(".cv-foot");
  var keys = Array.prototype.slice.call(room.querySelectorAll(".cv-key"));
  var FIELDS = ["f", "s", "iso", "mm"];
  var led = {}, cell = {}, lamp = {};
  FIELDS.concat("n").forEach(function (k) { led[k] = vf.querySelector('[data-led="' + k + '"]'); });
  FIELDS.forEach(function (k) { cell[k] = vf.querySelector('[data-cell="' + k + '"]'); });
  ["l", "c", "r"].forEach(function (k) { lamp[k] = vf.querySelector('[data-lamp="' + k + '"]'); });
  var ghost = document.createElement("img");
  ghost.className = "vf-ghost";
  ghost.alt = "";
  ghost.draggable = false;
  ghost.hidden = true;
  patch.appendChild(ghost);
  var touchy = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  var zoomBtns = Array.prototype.slice.call(room.querySelectorAll("[data-cv-zoom]"));
  var zoomEl = room.querySelector(".cv-zoom");
  if (hint && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) hint.textContent = "Drag to look around · pinch to zoom · tap to open";

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ease(dt, tau) { return 1 - Math.exp(-dt / tau); }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Sizes ---------- */
  var vw = 1, vh = 1, narrow = false, Lb = 200, cw = 1, ch = 1, W = 1, H = 1, items = [], wall = null;
  var pw = 0, ph = 0, pw0 = 0, ph0 = 0, patchK = -1, ledH = 30, capH = 16, hintH = 16, footH = 40;
  var belowW = 420, zoomBox = null, belowY = -1, belowSet = -1, maskCut = "", baked = 0, docked = false;
  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    narrow = vw < 700;
    // the long side of a photograph on the wall, fully pulled back
    Lb = clamp(Math.min(vw, vh * 1.6) * 0.21, 112, 330);
    // the focus patch at its own size; zoomed out it shrinks with the frame lines
    patch.style.width = patch.style.height = "";
    pw = pw0 = patch.offsetWidth;
    ph = ph0 = patch.offsetHeight;
    patchK = -1;
    ledH = below.firstElementChild.offsetHeight || ledH;
    capH = 16;
    hintH = hint ? hint.offsetHeight || hintH : 0;
    footH = foot ? foot.offsetHeight : 0;
    room.style.setProperty("--foot-h", footH + "px");
    belowW = below.offsetWidth || belowW;
    var zb = zoomEl && zoomEl.offsetWidth ? zoomEl.getBoundingClientRect() : null;
    zoomBox = zb ? { l: zb.left, t: zb.top } : null;
    maskCut = "";
  }
  // A photograph's size on screen when it is framed.
  function shown(p) {
    var land = p.ar >= 1;
    var maxW = land && !narrow ? vw * 0.56 : vw * 0.86;
    var maxH = vh * (land ? (narrow ? 0.46 : 0.56) : (narrow ? 0.54 : 0.62));
    var w = Math.min(maxW, maxH * p.ar);
    return { w: w, h: w / p.ar };
  }

  /* ---------- The wall ---------- */
  function build() {
    measure();
    plane.textContent = "";
    // the wall scales inside the plane, which stays the size of the window: it keeps
    // the clipping at the window's edges and takes the drags wherever they start
    wall = document.createElement("div");
    wall.className = "cv-wall";
    plane.appendChild(wall);
    items = [];
    baked = 0;
    cw = Lb * 1.16;
    ch = Lb * 0.97;
    // the wall is wider and taller than the window, zoomed right out, by a few cells, so copies never pop
    var cols = Math.ceil(vw / (cw * S_MIN)) + 3, rows = Math.ceil(vh / (ch * S_MIN)) + 3;
    if (rows % 2) rows++;
    W = cols * cw;
    H = rows * ch;
    var cells = cols * rows, r = rng(7), order = [];
    while (order.length < cells) {
      var batch = photos.map(function (p, n) { return n; });
      for (var k = batch.length - 1; k > 0; k--) {
        var j = Math.floor(r() * (k + 1)), t = batch[k];
        batch[k] = batch[j];
        batch[j] = t;
      }
      if (order.length && N > 1 && batch[0] === order[order.length - 1]) batch.push(batch.shift());
      order = order.concat(batch);
    }
    order.length = cells;
    // keep a photograph from sitting straight under its own copy
    for (var c2 = cols; c2 < cells - 1; c2++) {
      if (N > 2 && order[c2] === order[c2 - cols]) { var tmp = order[c2]; order[c2] = order[c2 + 1]; order[c2 + 1] = tmp; }
    }
    var sizes = [1, 0.76, 0.9, 0.68, 0.85, 0.96, 0.8];
    for (var n = 0; n < cells; n++) {
      var c = n % cols, row = Math.floor(n / cols), i = order[n], p = photos[i];
      var sc = sizes[(n * 5 + row * 3) % sizes.length];
      // equal area for every shape, kept inside its cell
      var A = Lb * Lb * 0.75 * sc * sc;
      var w = Math.sqrt(A * p.ar), h = Math.sqrt(A / p.ar);
      var fit = Math.min(1, (Lb * 1.04) / w, (Lb * 0.86) / h);
      w *= fit;
      h *= fit;
      var bx = (c + (row % 2) * 0.5) * cw + (cw - w) * (0.3 + 0.4 * r());
      var by = row * ch + (ch - h) * (0.3 + 0.4 * r());
      var el = document.createElement("div");
      el.className = "cv-item";
      el.setAttribute("data-photo", "");
      el.style.width = w.toFixed(1) + "px";
      el.style.height = h.toFixed(1) + "px";
      var img = document.createElement("img");
      img.src = p.thumb;
      img.alt = "";
      img.width = p.w;
      img.height = p.h;
      img.decoding = "async";
      img.draggable = false;
      el.appendChild(img);
      wall.appendChild(el);
      items.push({ el: el, img: img, bx: bx, by: by, w: w, h: h, i: i, x: 0, y: 0, px: 1e9, py: 1e9 });
    }
    sharp = null;
  }
  // Where a photograph sits at a given wall offset: wrapped around the window's centre.
  function wrap(v, size, mid) { var a = mid - size / 2; return mod(v - a, size) + a; }
  function posOf(it, dx, dy) {
    return {
      x: wrap(it.bx + dx + it.w / 2, W, vw / 2) - it.w / 2,
      y: wrap(it.by + dy + it.h / 2, H, vh / 2) - it.h / 2
    };
  }
  function centreDist(it, q) { return Math.hypot(q.x + it.w / 2 - vw / 2, q.y + it.h / 2 - vh / 2); }
  function nearest(dx, dy, only) {
    var best = null, bd = Infinity;
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      if (only != null && it.i !== only) continue;
      var q = posOf(it, dx, dy), d = centreDist(it, q);
      if (d < bd) { bd = d; best = { it: it, x: q.x, y: q.y, dx: dx, dy: dy }; }
    }
    return best;
  }

  /* ---------- State ---------- */
  var ox = 0, oy = 0, tx = 0, ty = 0, vx = 0, vy = 0, s = 1, sTo = 1;
  // Zoom by hand: a factor on the framed scale. Out as far as the wall at S_MIN of its
  // pulled-back size, in to Z_MAX times the framed photograph.
  var S_MIN = 0.6, Z_MAX = 2.6, zoom = 1, pinch = null;
  function zr() { return clamp(zoom, S_MIN / sTo, Z_MAX); }
  function restScale() { return Math.max(S_MIN, sTo * zr()); }
  // Zoom about a point on the screen (the fingers, the pointer), or the centre.
  function setZoom(z, mx, my) {
    var s0 = restScale();
    zoom = clamp(z, S_MIN / sTo, Z_MAX);
    var s1 = restScale();
    if (mx != null) {
      tx += (mx - vw / 2) * (1 / s1 - 1 / s0);
      ty += (my - vh / 2) * (1 / s1 - 1 / s0);
    }
    hold = 0;
    opening = false;
    hideHint();
    pendingShot = null;
    vx = vy = 0;
    zoomState();
  }
  function zoomState() {
    zoomBtns.forEach(function (b) {
      var out = b.getAttribute("data-cv-zoom") === "out";
      b.disabled = out ? zr() <= S_MIN / sTo + 1e-3 : zr() >= Z_MAX - 1e-3;
    });
  }
  function zoomStep(dir) {
    setZoom(zr() * (dir > 0 ? 1.4 : 1 / 1.4));
    lockNearest();
  }
  var fr = { L: 1, S: 1, rot: 0 }, frTo = { L: 1, S: 1, rot: 0 }, frDirty = true;
  var dragging = false, wheeling = false, hold = 0, subject = null, lockOn = null;
  var fe = 22, focusedAt = 0, moved = 0, spd = 0, last = 0, maskA = 0.58, pendingShot = null;
  var sharp = null, opening = false;

  // Frame a photograph: move it to the centre, close in until it fills the frame,
  // and set the frame lines around it (turned a quarter for a portrait one).
  function lock(t) {
    if (!t) return;
    lockOn = t.it;
    tx = t.dx + (vw / 2 - (t.x + t.it.w / 2));
    ty = t.dy + (vh / 2 - (t.y + t.it.h / 2));
    var p = photos[t.it.i], d = shown(p);
    sTo = Math.max(1, d.w / t.it.w);
    var m = clamp(Math.min(d.w, d.h) * 0.035, 9, 20);
    frTo = p.ar >= 1 ? { L: d.w + 2 * m, S: d.h + 2 * m, rot: 0 } : { L: d.h + 2 * m, S: d.w + 2 * m, rot: 90 };
    vx = vy = 0;
    zoomState();
  }
  function lockNearest() { lock(nearest(tx, ty)); }
  function lockPhoto(i) { lock(nearest(tx, ty, i)); }

  /* ---------- The readout ---------- */
  function digits(v) { return String(v || "").replace(/[^0-9.]/g, ""); }
  function ledText(p) {
    var e = p.exif || {};
    var f = digits(String(e.aperture || "").replace(/^f\//i, ""));
    if (/^\d+$/.test(f) && +f < 10) f += ".0";
    var raw = String(e.shutter || "").replace(/\s*s$/i, "").trim(), sh = "", sl = "1/";
    if (/^1\/\d+$/.test(raw)) sh = raw.slice(2);
    else if (raw && !/\//.test(raw)) { sh = digits(raw); sl = "S"; }
    return { f: f, s: sh, sl: sl, iso: digits(String(e.iso || "").replace(/^ISO\s*/i, "")), mm: digits(e.focal), n: pad(p.i + 1) };
  }
  function setLed(k, v) {
    led[k].textContent = v;
    led[k].setAttribute("data-off", v.replace(/\d/g, "8"));
  }
  var rollT = 0, shownPhoto = -1, lampTest = false;
  function showReadout(i) {
    shownPhoto = i;
    var p = photos[i], v = ledText(p), any = false;
    FIELDS.forEach(function (k) { cell[k].hidden = !v[k]; if (v[k]) any = true; });
    exifEl.hidden = !any;
    sLabel.textContent = v.sl;
    var cap = [p.title, p.place, p.year].filter(Boolean).join(" · ");
    capEl.textContent = cap;
    capEl.hidden = !cap;
    belowW = below.offsetWidth || belowW;
    clearInterval(rollT);
    var live = FIELDS.filter(function (k) { return v[k]; }).concat("n");
    if (still()) { live.forEach(function (k) { setLed(k, v[k]); }); return; }
    // the digits roll like a counter, then settle
    var ticks = 0;
    rollT = setInterval(function () {
      ticks++;
      live.forEach(function (k) {
        setLed(k, ticks >= 6 ? v[k] : v[k].replace(/\d/g, function () { return String(Math.floor(Math.random() * 10)); }));
      });
      if (ticks >= 6) clearInterval(rollT);
    }, 40);
  }
  function setLamp(side) {
    lamp.l.classList.toggle("is-on", side === "l");
    lamp.c.classList.toggle("is-on", side === "c");
    lamp.r.classList.toggle("is-on", side === "r");
  }

  // The framed photograph, sharp: swap the thumbnail for the full image once it has decoded.
  function sharpen(it) {
    if (sharp === it) return;
    if (sharp) { sharp.img.src = photos[sharp.i].thumb; sharp.el.classList.remove("is-sharp"); }
    sharp = it;
    it.el.classList.add("is-sharp");
    var p = photos[it.i];
    if (!p.src || p.src === p.thumb) return;
    if (it.w * s * (window.devicePixelRatio || 1) <= (it.img.naturalWidth || 0) * 1.05) return;
    var pre = new Image();
    pre.src = p.src;
    var swap = function () { if (sharp === it) it.img.src = p.src; };
    if (pre.decode) pre.decode().then(swap, function () {});
    else pre.onload = swap;
  }

  // The veil outside the frame: the window, with the frame (as turned) cut out of it.
  function cutMask(rad) {
    var c = Math.cos(rad), sn = Math.sin(rad), a = fr.L / 2, b = fr.S / 2, cx = vw / 2, cy = vh / 2;
    var pts = [[-a, -b], [a, -b], [a, b], [-a, b]].map(function (p) {
      return (cx + p[0] * c - p[1] * sn).toFixed(1) + "px " + (cy + p[0] * sn + p[1] * c).toFixed(1) + "px";
    });
    var cut = "polygon(evenodd, 0 0, " + vw + "px 0, " + vw + "px " + vh + "px, 0 " + vh + "px, 0 0, " + pts.join(", ") + ", " + pts[0] + ", 0 0)";
    if (cut === maskCut) return;
    maskCut = cut;
    maskEl.style.webkitClipPath = cut;
    maskEl.style.clipPath = cut;
  }
  // Where the readout docks: above the footer, and above the zoom buttons where it would meet them.
  function dockY(h) {
    var y = vh - footH - 14;
    if (zoomBox && vw / 2 + belowW / 2 > zoomBox.l - 8) y = Math.min(y, zoomBox.t - 12);
    return Math.max(vh / 2, y - h);
  }

  /* ---------- The frame loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? clamp(now - last, 0, 50) : 16;
    last = now;
    if (root.classList.contains("gl-open")) return;
    var calm = still(), waking = now < hold;

    // inertia, then the nearest photograph is framed
    var coasting = !dragging && Math.abs(vx) + Math.abs(vy) > 0.012;
    if (coasting) {
      tx += vx * dt;
      ty += vy * dt;
      var decay = Math.exp(-dt / 260);
      vx *= decay;
      vy *= decay;
      if (Math.abs(vx) + Math.abs(vy) <= 0.012) { vx = vy = 0; lockNearest(); }
    }
    var moving = dragging || wheeling || coasting || !!pinch;
    // how hard the wall is moving, in screen pixels per frame
    var inst = dragging || wheeling ? moved * (16 / Math.max(dt, 1)) : Math.hypot(vx, vy) * s * 16;
    moved = 0;
    spd += (inst - spd) * ease(dt, 90);

    if (calm || pinch) { ox = tx; oy = ty; }
    else if (!waking) {
      var a = ease(dt, dragging ? 22 : opening ? 300 : 120);
      ox += (tx - ox) * a;
      oy += (ty - oy) * a;
    }
    var dist = Math.abs(tx - ox) + Math.abs(ty - oy);

    // the lens pulls back with speed, and over a long glide
    var pull = clamp((spd - 1.5) / 20, 0, 1);
    if (dragging) pull = Math.max(pull, 0.28);
    if (!moving) pull = Math.max(pull, clamp((dist * s) / (vw * 0.5), 0, 1) * 0.7);
    var z = zr(), sRest = restScale();
    var sGoal = Math.max(S_MIN, (sTo + (1 - sTo) * pull) * z);
    if (calm || pinch) s = sGoal;
    else if (!waking) s += (sGoal - s) * ease(dt, opening ? 380 : 140);
    // While the wall moves it is scaled as one layer. Once it rests, the scale goes into
    // each photograph's own size instead, so each is drawn at the size it shows: Safari
    // keeps a scaled layer at the resolution it was drawn at, and would show it soft.
    var rest = !moving && !waking && !pinch && Math.abs(s - sGoal) < 2e-4;
    if (rest) s = sGoal;
    var bake = rest ? s : 0;
    if (bake !== baked) {
      baked = bake;
      wall.style.transform = bake ? "none" : "scale(" + s.toFixed(4) + ")";
      for (var b2 = 0; b2 < items.length; b2++) {
        var ib = items[b2], f = bake || 1;
        ib.el.style.width = (ib.w * f).toFixed(1) + "px";
        ib.el.style.height = (ib.h * f).toFixed(1) + "px";
        ib.px = 1e9;
      }
    } else if (!baked) wall.style.transform = "scale(" + s.toFixed(4) + ")";
    for (var k = 0; k < items.length; k++) {
      var it = items[k], q = posOf(it, ox, oy);
      it.x = q.x;
      it.y = q.y;
      var X = baked ? vw / 2 + (q.x - vw / 2) * baked : q.x, Y = baked ? vh / 2 + (q.y - vh / 2) * baked : q.y;
      if (Math.abs(X - it.px) > 0.05 || Math.abs(Y - it.py) > 0.05) {
        it.px = X;
        it.py = Y;
        it.el.style.transform = "translate3d(" + X.toFixed(2) + "px," + Y.toFixed(2) + "px,0)";
      }
    }

    // the frame lines: resized and turned toward the framed photograph (zoomed out,
    // they close round it; zoomed in, they stay and the photograph grows past them)
    var fa = calm || pinch ? 1 : ease(dt, 150), fz = sRest / sTo > 1 ? 1 : sRest / sTo;
    var fL = frTo.L * fz, fS = frTo.S * fz;
    // the focus patch keeps its size against the frame lines (never smaller than a third)
    var pk = Math.max(0.35, fz);
    if (Math.abs(pk - patchK) > 0.002) {
      patchK = pk;
      pw = pw0 * pk;
      ph = ph0 * pk;
      patch.style.width = pw.toFixed(1) + "px";
      patch.style.height = ph.toFixed(1) + "px";
    }
    var frErr = Math.abs(fL - fr.L) + Math.abs(fS - fr.S) + Math.abs(frTo.rot - fr.rot);
    if (frErr > 0.02 || frDirty) {
      frDirty = false;
      fr.L += (fL - fr.L) * fa;
      fr.S += (fS - fr.S) * fa;
      fr.rot += (frTo.rot - fr.rot) * fa;
      frameEl.style.width = fr.L.toFixed(1) + "px";
      frameEl.style.height = fr.S.toFixed(1) + "px";
      frameEl.style.transform = "translate(-50%,-50%) rotate(" + fr.rot.toFixed(2) + "deg)";
      var rad = (fr.rot * Math.PI) / 180;
      var halfH = (fr.L * Math.abs(Math.sin(rad)) + fr.S * Math.abs(Math.cos(rad))) / 2;
      vf.style.setProperty("--fy", halfH.toFixed(1) + "px");
      cutMask(rad);
    }
    // The readout sits under the frame lines; zoomed out, when they close round a small
    // photograph among the others, it docks at the foot of the window, clear of the wall.
    var radB = (fr.rot * Math.PI) / 180;
    var underY = vh / 2 + (fr.L * Math.abs(Math.sin(radB)) + fr.S * Math.abs(Math.cos(radB))) / 2 + 16;
    var belowH = ledH + (capEl.hidden ? 0 : capH + 10);
    var dock = fz < 0.97;
    if (dock !== docked) { docked = dock; vf.classList.toggle("is-docked", dock); }
    var bGoal = dock ? dockY(belowH) : underY;
    belowY = belowY < 0 || calm ? bGoal : belowY + (bGoal - belowY) * ease(dt, 110);
    if (Math.abs(belowY - belowSet) > 0.3) {
      belowSet = belowY;
      vf.style.setProperty("--below-y", belowY.toFixed(1) + "px");
      // the hint goes when it would run into the footer
      if (hint) hint.hidden = belowY + belowH + 10 + hintH > vh - footH - 6;
    }

    // which photograph is in the frame now, and how far it is from focus
    var nb = nearest(ox, oy);
    subject = nb ? nb.it : null;
    if (!subject) return;
    if (!lampTest && subject.i !== shownPhoto) showReadout(subject.i);
    var off = (nb.x + subject.w / 2 - vw / 2) * s;
    var goal = moving || waking ? 22 : clamp(dist * s * 0.08 + Math.abs(s - sRest) * 60 + frErr * 0.04, 0, 22);
    fe += (goal - fe) * (calm ? 1 : ease(dt, 150));
    var focused = !moving && !waking && fe < 0.5 && dist * s < 1 && Math.abs(s - sRest) < 0.004 && frErr < 0.6;
    if (focused && !focusedAt) { focusedAt = now; opening = false; }
    if (!focused) focusedAt = 0;
    var sharpNow = focused && now - focusedAt > 120;
    vf.classList.toggle("is-focused", sharpNow);
    if (!lampTest) setLamp(sharpNow ? "c" : fe < 0.5 ? "" : off < -2 ? "l" : off > 2 ? "r" : "");

    // outside the frame the wall darkens as it comes to rest
    var mGoal = 0.58 - 0.44 * pull;
    maskA += (mGoal - maskA) * (calm ? 1 : ease(dt, 160));
    maskEl.style.opacity = maskA.toFixed(3);

    // the focus patch: the picture's ghost, offset by the focus error
    if (!calm) {
      var sx = vw / 2 + (nb.x - vw / 2) * s, sy = vh / 2 + (nb.y - vh / 2) * s;
      var src = subject.img.getAttribute("src");
      if (ghost.getAttribute("src") !== src) { ghost.src = src; ghost.hidden = false; }
      ghost.style.width = (subject.w * s).toFixed(1) + "px";
      ghost.style.transform = "translate(" + (sx - (vw / 2 - pw / 2) - 1 + (off < 0 ? -fe : fe)).toFixed(1) + "px," + (sy - (vh / 2 - ph / 2) - 1).toFixed(1) + "px)";
    }

    if (sharpNow && lockOn === subject) sharpen(subject);
    if (focused && pendingShot && now - focusedAt > 60) { var shot = pendingShot; pendingShot = null; fire(shot); }
  }

  /* ---------- Input: drag, inertia, scroll, keys ---------- */
  var down = null, samples = [], wheelT = 0;
  function hideHint() { if (hint) hint.classList.add("is-gone"); }
  function takeOver() {
    hold = 0;
    opening = false;
    hideHint();
    lockOn = null;
    pendingShot = null;
    vx = vy = 0;
  }
  // Every finger or pointer on the wall; two make a pinch, which zooms and pans at once.
  var ptrs = {};
  function twoPoints() {
    var k = Object.keys(ptrs);
    if (k.length < 2) return null;
    var a = ptrs[k[0]], b = ptrs[k[1]];
    return { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  plane.addEventListener("pointerdown", function (e) {
    if (root.classList.contains("gl-open") || e.button > 0) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    plane.setPointerCapture(e.pointerId);
    var two = twoPoints();
    if (two) {
      // a drag already going hands over to the pinch
      dragging = false;
      down = null;
      plane.classList.remove("is-dragging");
      takeOver();
      pinch = two;
      return;
    }
    if (pinch) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    samples = [{ x: e.clientX, y: e.clientY, t: down.t }];
    plane.setPointerCapture(e.pointerId);
  });
  plane.addEventListener("pointermove", function (e) {
    if (ptrs[e.pointerId]) ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch) {
      var two = twoPoints();
      if (!two) return;
      setZoom(zr() * (two.d / pinch.d), two.x, two.y);
      var sNow = restScale();
      tx += (two.x - pinch.x) / sNow;
      ty += (two.y - pinch.y) / sNow;
      pinch = two;
      return;
    }
    if (!down || e.pointerId !== down.id) return;
    var lastS = samples[samples.length - 1];
    var dx = e.clientX - lastS.x, dy = e.clientY - lastS.y;
    if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
      dragging = true;
      takeOver();
      plane.classList.add("is-dragging");
    }
    if (!dragging) return;
    tx += dx / s;
    ty += dy / s;
    moved += Math.hypot(dx, dy);
    samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (samples.length > 8) samples.shift();
  });
  function endDrag(e) {
    if (!down || (e && e.pointerId !== down.id)) return;
    var t = performance.now(), wasDrag = dragging, wasClick = !dragging && t - down.t < 500;
    dragging = false;
    plane.classList.remove("is-dragging");
    down = null;
    if (!wasDrag) {
      if (!wasClick) return;
      if (e && e.type === "pointerup") {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var box = el && el.closest ? el.closest(".cv-item") : null;
        var hit = box ? items.filter(function (x) { return x.el === box; })[0] : null;
        if (hit) { shoot(hit); return; }
      }
      if (!lockOn) lockNearest();
      return;
    }
    // release velocity from the last tenth of a second of movement
    var b = samples[samples.length - 1], a = b;
    for (var k = samples.length - 1; k >= 0 && t - samples[k].t <= 100; k--) a = samples[k];
    var span = Math.max(10, b.t - a.t);
    if (still() || t - b.t > 80) { vx = vy = 0; }
    else {
      vx = clamp((b.x - a.x) / span / s, -3, 3);
      vy = clamp((b.y - a.y) / span / s, -3, 3);
    }
    if (Math.abs(vx) + Math.abs(vy) <= 0.012) { vx = vy = 0; lockNearest(); }
  }
  function pointerEnd(e) {
    delete ptrs[e.pointerId];
    if (pinch) {
      if (!twoPoints()) { pinch = null; lockNearest(); }
      return;
    }
    endDrag(e);
  }
  plane.addEventListener("pointerup", pointerEnd);
  plane.addEventListener("pointercancel", pointerEnd);
  // The wheel zooms, about the pointer. With Ctrl (or Cmd) held, each notch moves to the
  // next or the previous photograph. A trackpad pinch also arrives as Ctrl + wheel, but
  // without the key really held, so it is told apart by the key itself and zooms.
  var keyHeld = false, stepAcc = 0, stepLast = 0, stepAt = 0;
  function stepPhoto(dir) {
    var cur = lockOn ? lockOn.i : subject ? subject.i : 0;
    hold = 0;
    opening = false;
    hideHint();
    pendingShot = null;
    lockPhoto(mod(cur + dir, N));
  }
  window.addEventListener("keydown", function (e) { if (e.key === "Control" || e.key === "Meta") keyHeld = true; });
  window.addEventListener("keyup", function (e) { if (e.key === "Control" || e.key === "Meta") keyHeld = false; });
  window.addEventListener("blur", function () { keyHeld = false; });
  window.addEventListener("wheel", function (e) {
    if (root.classList.contains("gl-open")) return;
    e.preventDefault();
    var unit = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 300 : 1;
    var dy = (e.deltaY || (e.shiftKey ? e.deltaX : 0)) * unit, now = performance.now();
    if ((e.ctrlKey || e.metaKey) && keyHeld) {
      // a notch (or a steady scroll) at a time, not every event of it
      if (now - stepLast > 320) stepAcc = 0;
      stepLast = now;
      stepAcc += dy;
      if (Math.abs(stepAcc) >= 40 && now - stepAt > 260) {
        stepPhoto(stepAcc > 0 ? 1 : -1);
        stepAcc = 0;
        stepAt = now;
      }
      return;
    }
    // a pinch zooms faster per event than a wheel notch
    setZoom(zr() * Math.exp(-clamp(dy, -60, 60) * (e.ctrlKey ? 0.01 : 0.0045)), e.clientX, e.clientY);
    wheeling = true;
    clearTimeout(wheelT);
    wheelT = setTimeout(function () { wheeling = false; lockNearest(); }, 220);
  }, { passive: false });
  // Safari on a Mac sends a trackpad pinch as gesture events. On touch screens the
  // pointers above do the pinch; there these only keep the page itself from zooming.
  var gz = 1;
  room.addEventListener("gesturestart", function (e) {
    e.preventDefault();
    if (touchy) return;
    gz = zr();
    takeOver();
  });
  room.addEventListener("gesturechange", function (e) {
    e.preventDefault();
    if (touchy || root.classList.contains("gl-open")) return;
    setZoom(gz * e.scale, e.clientX, e.clientY);
    wheeling = true;
  });
  room.addEventListener("gestureend", function (e) {
    e.preventDefault();
    if (touchy) return;
    wheeling = false;
    lockNearest();
  });
  zoomBtns.forEach(function (b) {
    b.addEventListener("click", function () { zoomStep(b.getAttribute("data-cv-zoom") === "out" ? -1 : 1); });
  });

  // Arrow keys: to the neighbouring photograph in that direction.
  function neighbour(dx, dy) {
    var best = null, bd = Infinity;
    items.forEach(function (it) {
      var q = posOf(it, tx, ty);
      var cx = q.x + it.w / 2 - vw / 2, cy = q.y + it.h / 2 - vh / 2;
      var along = cx * dx + cy * dy, across = Math.abs(cx * dy - cy * dx);
      if (along < 20) return;
      var score = along + across * 2;
      if (score < bd) { bd = score; best = { it: it, x: q.x, y: q.y, dx: tx, dy: ty }; }
    });
    return best;
  }
  document.addEventListener("keydown", function (e) {
    if (root.classList.contains("gl-open") || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = e.target.tagName;
    var zk = { "+": 1, "=": 1, "-": -1, "_": -1 }[e.key];
    if (zk && tag !== "INPUT") { e.preventDefault(); zoomStep(zk); return; }
    if (e.key === "0" && tag !== "INPUT") { e.preventDefault(); setZoom(1); lockNearest(); return; }
    var dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (dir) {
      e.preventDefault();
      hold = 0;
      opening = false;
      hideHint();
      pendingShot = null;
      lock(neighbour(dir[0], dir[1]));
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON" && tag !== "A" && subject) { e.preventDefault(); shoot(subject); }
  });
  keys.forEach(function (b) {
    var i = +b.getAttribute("data-cv-i");
    b.addEventListener("focus", function () { hold = 0; opening = false; hideHint(); lockPhoto(i); });
    b.addEventListener("click", function () {
      if (!lockOn || lockOn.i !== i) lockPhoto(i);
      if (lockOn) shoot(lockOn, b);
    });
  });

  /* ---------- The shutter ---------- */
  // Zoomed out, a click zooms back in on the photograph clicked; at the framed size or
  // closer, a click opens the close-up straight from where the photograph is, and behind
  // it the wall frames that photograph, ready for when it closes.
  function shoot(it, back) {
    hideHint();
    hold = 0;
    opening = false;
    pendingShot = null;
    if (zr() < 0.97) {
      setZoom(1);
      lock({ it: it, x: it.x, y: it.y, dx: ox, dy: oy });
      return;
    }
    var framed = subject === it && lockOn === it;
    if (lockOn !== it) lock({ it: it, x: it.x, y: it.y, dx: ox, dy: oy });
    fire({ it: it, back: back }, !framed);
  }
  function fire(shot, quick) {
    var it = shot.it, back = shot.back || keys[it.i];
    var open = function () { G.open(it.i, it.img, back, it.img.currentSrc || it.img.src); };
    // the shutter only crosses the frame lines when it is their photograph that is taken
    if (quick || still() || !shutter.animate) { open(); return; }
    // two curtains: the first closes across the frame, the second opens behind it
    shutter.animate([
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0 0 0)", offset: 0.45 },
      { clipPath: "inset(0 0 0 100%)" }
    ], { duration: 300, easing: "cubic-bezier(.6,0,.4,1)" });
    setTimeout(open, 135);
  }
  G.onClose = function (i, moved) { if (moved) lockPhoto(i); };

  /* ---------- The close-up: the same LED readout, under the photograph ---------- */
  var glLed = document.querySelector(".gl__led"), glRoll = 0;
  G.onFill = function (i) {
    if (!glLed) return;
    var v = ledText(photos[i]);
    var cells = [["f", "<em>F</em>", ""], ["s", "<em>" + v.sl + "</em>", ""], ["iso", "<em>ISO</em>", ""], ["mm", "", "<em>MM</em>"]]
      .filter(function (c) { return v[c[0]]; });
    glLed.innerHTML = '<div class="vf-led">' +
      (cells.length ? '<span class="vf-led__exif">' + cells.map(function (c) {
        return '<span class="vf-led__cell">' + c[1] + '<b data-k="' + c[0] + '"></b>' + c[2] + "</span>";
      }).join("") + "</span>" : "") +
      '<span class="vf-led__cell vf-led__cell--n"><b data-k="n"></b></span></div>';
    var bs = Array.prototype.slice.call(glLed.querySelectorAll("b[data-k]"));
    var put = function (b, t) { b.textContent = t; b.setAttribute("data-off", t.replace(/\d/g, "8")); };
    clearInterval(glRoll);
    if (still()) { bs.forEach(function (b) { put(b, v[b.getAttribute("data-k")]); }); return; }
    // every segment lit for a moment, then the digits roll and settle
    var ticks = 0;
    bs.forEach(function (b) { put(b, v[b.getAttribute("data-k")].replace(/\d/g, "8")); });
    glRoll = setInterval(function () {
      ticks++;
      bs.forEach(function (b) {
        var t = v[b.getAttribute("data-k")];
        put(b, ticks >= 9 ? t : ticks < 4 ? t.replace(/\d/g, "8") : t.replace(/\d/g, function () { return String(Math.floor(Math.random() * 10)); }));
      });
      if (ticks >= 9) clearInterval(glRoll);
    }, 45);
  };

  /* ---------- Start: the camera wakes ---------- */
  function startAt(i, offX, offY) {
    var t = nearest(0, 0, i) || nearest(0, 0);
    ox = tx = vw / 2 - (t.it.bx + t.it.w / 2);
    oy = ty = vh / 2 - (t.it.by + t.it.h / 2);
    lock(nearest(tx, ty, i));
    var fz0 = Math.min(1, restScale() / sTo);
    fr = { L: frTo.L * fz0, S: frTo.S * fz0, rot: frTo.rot };
    frDirty = true;
    ox += offX;
    oy += offY;
  }
  build();
  if (still()) {
    startAt(0, 0, 0);
    s = restScale();
  } else {
    // pulled right back over the wall, the first photograph off to one side
    startAt(0, cw * 1.3, ch * 0.8);
    s = 1;
    opening = true;
    // lamp test: every segment and lamp lit for a moment, as a camera does when it wakes
    lampTest = true;
    vf.classList.add("is-test");
    setLed("n", "88");
    hold = performance.now() + 650;
    setTimeout(function () {
      lampTest = false;
      vf.classList.remove("is-test");
      if (subject) showReadout(subject.i);
    }, 650);
  }
  requestAnimationFrame(frame);
  if (hint) setTimeout(hideHint, 9000);
  var rT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      var keep = lockOn ? lockOn.i : subject ? subject.i : 0;
      build();
      startAt(keep, 0, 0);
      s = restScale();
    }, 120);
  });
})();
