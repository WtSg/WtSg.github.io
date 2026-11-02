/*
 * Endless canvas, seen through a rangefinder.
 * - The photographs hang on a wall that repeats in every direction. Drag it,
 *   scroll it or use the arrow keys; it carries on with inertia.
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
 * - Reduced motion: no inertia, zoom, turn or shutter; frames change at once.
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
  if (hint && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) hint.textContent = "Drag to look around · tap to open";

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
  var vw = 1, vh = 1, narrow = false, Lb = 200, cw = 1, ch = 1, W = 1, H = 1, items = [];
  var pw = 0, ph = 0, ledH = 30, capH = 16, hintH = 16, footH = 40;
  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    narrow = vw < 700;
    // the long side of a photograph on the wall, fully pulled back
    Lb = clamp(Math.min(vw, vh * 1.6) * 0.21, 112, 330);
    pw = patch.offsetWidth;
    ph = patch.offsetHeight;
    ledH = below.firstElementChild.offsetHeight || ledH;
    capH = 16;
    hintH = hint ? hint.offsetHeight || hintH : 0;
    footH = foot ? foot.offsetHeight : 0;
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
    items = [];
    cw = Lb * 1.16;
    ch = Lb * 0.97;
    // the wall is wider and taller than the window by a few cells, so copies never pop
    var cols = Math.ceil(vw / cw) + 3, rows = Math.ceil(vh / ch) + 3;
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
      plane.appendChild(el);
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
  var fr = { L: 1, S: 1, rot: 0 }, frTo = { L: 1, S: 1, rot: 0 }, frDirty = true;
  var dragging = false, wheeling = false, hold = 0, subject = null, lockOn = null;
  var fe = 22, focusedAt = 0, moved = 0, spd = 0, last = 0, maskA = 0.58, pendingShot = null;
  var sharp = null;

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
    if (sharp) sharp.img.src = photos[sharp.i].thumb;
    sharp = it;
    var p = photos[it.i];
    if (!p.src || p.src === p.thumb) return;
    if (shown(p).w * (window.devicePixelRatio || 1) <= (it.img.naturalWidth || 0) * 1.05) return;
    var pre = new Image();
    pre.src = p.src;
    var swap = function () { if (sharp === it) it.img.src = p.src; };
    if (pre.decode) pre.decode().then(swap, function () {});
    else pre.onload = swap;
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
    var moving = dragging || wheeling || coasting;
    // how hard the wall is moving, in screen pixels per frame
    var inst = dragging || wheeling ? moved * (16 / Math.max(dt, 1)) : Math.hypot(vx, vy) * s * 16;
    moved = 0;
    spd += (inst - spd) * ease(dt, 90);

    if (calm) { ox = tx; oy = ty; }
    else if (!waking) {
      var a = ease(dt, dragging ? 22 : 120);
      ox += (tx - ox) * a;
      oy += (ty - oy) * a;
    }
    var dist = Math.abs(tx - ox) + Math.abs(ty - oy);

    // the lens pulls back with speed, and over a long glide
    var pull = clamp((spd - 1.5) / 20, 0, 1);
    if (dragging) pull = Math.max(pull, 0.28);
    if (!moving) pull = Math.max(pull, clamp((dist * s) / (vw * 0.5), 0, 1) * 0.7);
    var sGoal = sTo + (1 - sTo) * pull;
    if (calm) s = sTo;
    else if (!waking) s += (sGoal - s) * ease(dt, 140);
    plane.style.transform = "scale(" + s.toFixed(4) + ")";
    for (var k = 0; k < items.length; k++) {
      var it = items[k], q = posOf(it, ox, oy);
      it.x = q.x;
      it.y = q.y;
      if (Math.abs(q.x - it.px) > 0.05 || Math.abs(q.y - it.py) > 0.05) {
        it.px = q.x;
        it.py = q.y;
        it.el.style.transform = "translate3d(" + q.x.toFixed(2) + "px," + q.y.toFixed(2) + "px,0)";
      }
    }

    // the frame lines: resized and turned toward the framed photograph
    var fa = calm ? 1 : ease(dt, 150);
    var frErr = Math.abs(frTo.L - fr.L) + Math.abs(frTo.S - fr.S) + Math.abs(frTo.rot - fr.rot);
    if (frErr > 0.02 || frDirty) {
      frDirty = false;
      fr.L += (frTo.L - fr.L) * fa;
      fr.S += (frTo.S - fr.S) * fa;
      fr.rot += (frTo.rot - fr.rot) * fa;
      frameEl.style.width = fr.L.toFixed(1) + "px";
      frameEl.style.height = fr.S.toFixed(1) + "px";
      frameEl.style.transform = "translate(-50%,-50%) rotate(" + fr.rot.toFixed(2) + "deg)";
      var rad = (fr.rot * Math.PI) / 180;
      var halfH = (fr.L * Math.abs(Math.sin(rad)) + fr.S * Math.abs(Math.cos(rad))) / 2;
      vf.style.setProperty("--fy", halfH.toFixed(1) + "px");
      // the hint goes when it would run into the footer
      if (hint) {
        var bottom = vh / 2 + halfH + 16 + ledH + (capEl.hidden ? 0 : capH + 10) + 10 + hintH;
        hint.hidden = bottom > vh - footH - 6;
      }
    }

    // which photograph is in the frame now, and how far it is from focus
    var nb = nearest(ox, oy);
    subject = nb ? nb.it : null;
    if (!subject) return;
    if (!lampTest && subject.i !== shownPhoto) showReadout(subject.i);
    var off = (nb.x + subject.w / 2 - vw / 2) * s;
    var goal = moving || waking ? 22 : clamp(dist * s * 0.08 + Math.abs(s - sTo) * 60 + frErr * 0.04, 0, 22);
    fe += (goal - fe) * (calm ? 1 : ease(dt, 150));
    var focused = !moving && !waking && fe < 0.5 && dist * s < 1 && Math.abs(s - sTo) < 0.004 && frErr < 0.6;
    if (focused && !focusedAt) focusedAt = now;
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
    hideHint();
    lockOn = null;
    pendingShot = null;
    vx = vy = 0;
  }
  plane.addEventListener("pointerdown", function (e) {
    if (root.classList.contains("gl-open") || e.button > 0) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    samples = [{ x: e.clientX, y: e.clientY, t: down.t }];
    plane.setPointerCapture(e.pointerId);
  });
  plane.addEventListener("pointermove", function (e) {
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
  plane.addEventListener("pointerup", endDrag);
  plane.addEventListener("pointercancel", endDrag);
  window.addEventListener("wheel", function (e) {
    if (root.classList.contains("gl-open") || e.ctrlKey) return;
    e.preventDefault();
    takeOver();
    var unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? vh : 1;
    var dx = e.deltaX * unit, dy = e.deltaY * unit;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    tx -= dx / s;
    ty -= dy / s;
    moved += Math.hypot(dx, dy) * 0.6;
    wheeling = true;
    clearTimeout(wheelT);
    wheelT = setTimeout(function () { wheeling = false; lockNearest(); }, 170);
  }, { passive: false });

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
    var dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (dir) {
      e.preventDefault();
      hold = 0;
      hideHint();
      pendingShot = null;
      lock(neighbour(dir[0], dir[1]));
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON" && tag !== "A" && subject) { e.preventDefault(); shoot(subject); }
  });
  keys.forEach(function (b) {
    var i = +b.getAttribute("data-cv-i");
    b.addEventListener("focus", function () { hold = 0; hideHint(); lockPhoto(i); });
    b.addEventListener("click", function () {
      if (!lockOn || lockOn.i !== i) lockPhoto(i);
      if (lockOn) shoot(lockOn, b);
    });
  });

  /* ---------- The shutter ---------- */
  function shoot(it, back) {
    hideHint();
    hold = 0;
    if (subject === it && lockOn === it && vf.classList.contains("is-focused")) { fire({ it: it, back: back }); return; }
    if (lockOn !== it) lock({ it: it, x: it.x, y: it.y, dx: ox, dy: oy });
    pendingShot = { it: it, back: back };
  }
  function fire(shot) {
    var it = shot.it, back = shot.back || keys[it.i];
    var open = function () { G.open(it.i, it.img, back, it.img.currentSrc || it.img.src); };
    if (still() || !shutter.animate) { open(); return; }
    // two curtains: the first closes across the frame, the second opens behind it
    shutter.animate([
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0 0 0)", offset: 0.45 },
      { clipPath: "inset(0 0 0 100%)" }
    ], { duration: 300, easing: "cubic-bezier(.6,0,.4,1)" });
    setTimeout(open, 135);
  }
  G.onClose = function (i, moved) { if (moved) lockPhoto(i); };

  /* ---------- Start: the camera wakes ---------- */
  function startAt(i, offX, offY) {
    var t = nearest(0, 0, i) || nearest(0, 0);
    ox = tx = vw / 2 - (t.it.bx + t.it.w / 2);
    oy = ty = vh / 2 - (t.it.by + t.it.h / 2);
    lock(nearest(tx, ty, i));
    fr = { L: frTo.L, S: frTo.S, rot: frTo.rot };
    frDirty = true;
    ox += offX;
    oy += offY;
  }
  build();
  if (still()) {
    startAt(0, 0, 0);
    s = sTo;
  } else {
    // pulled right back over the wall, the first photograph off to one side
    startAt(0, cw * 0.9, ch * 0.55);
    s = 1;
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
      s = sTo;
    }, 120);
  });
})();
