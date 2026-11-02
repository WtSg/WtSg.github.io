/*
 * Shared by the gallery versions that use it (the endless canvas for now): the
 * photo list from the page, the close-up viewer, and light friction against
 * casual saving. Each version styles the viewer in its own world (.gl tokens).
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function still() { return reduceMq.matches; }
  function strip(v) { return v == null ? "" : String(v).trim(); }
  function esc(s) {
    return strip(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- The photos ---------- */
  var dataEl = document.getElementById("gallery-data");
  var base = dataEl ? dataEl.getAttribute("data-base") || "" : "";
  var raw = [];
  try { raw = JSON.parse(dataEl ? dataEl.textContent : "[]") || []; } catch (e) { raw = []; }
  var photos = raw.map(function (p, i) {
    var w = +p.w || 3, h = +p.h || 2;
    return {
      i: i,
      src: base + p.src,
      thumb: base + (p.thumb || p.src),
      w: w,
      h: h,
      ar: w / h,
      title: strip(p.title),
      place: strip(p.place),
      year: strip(p.year),
      exif: p.exif || null
    };
  });

  function metaLine(p) {
    return [p.place, p.year].filter(Boolean).join(" · ");
  }
  function specLine(p) {
    var e = p.exif;
    if (!e) return "";
    return ["camera", "focal", "aperture", "shutter", "iso"].map(function (k) { return strip(e[k]); }).filter(Boolean).join(" · ");
  }
  function specRows(p) {
    var e = p.exif;
    if (!e) return [];
    return [
      ["Camera", e.camera], ["Lens", e.lens], ["Focal length", e.focal],
      ["Aperture", e.aperture], ["Shutter", e.shutter], ["ISO", strip(e.iso).replace(/^ISO\s*/i, "")]
    ].filter(function (r) { return strip(r[1]); });
  }
  function label(p) {
    return "No. " + (p.i + 1) + (p.title ? " · " + p.title : "");
  }
  function altText(p) {
    return (p.title || "Photograph No. " + (p.i + 1)) + (p.place ? ", " + p.place : "");
  }

  /* ---------- Owner shortcut and friction ---------- */
  try {
    if (localStorage.getItem("gallery-studio-owner") === "1") {
      Array.prototype.forEach.call(document.querySelectorAll("[data-owner-only]"), function (el) { el.hidden = false; });
    }
  } catch (e) {}
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest("[data-photo], .gl__img")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  /* ---------- The camera's maker, as its mark and its name ---------- */
  // [maker test, mark file ("" for none), name, mark width / height, the words dropped from
  // the model, the lettering its name is set in, whether the mark is only a symbol].
  // A symbol (Apple's apple, Leica's red dot) is followed by the maker's name; a mark that
  // spells the name in the maker's own lettering (SONY, FUJIFILM, HASSELBLAD) stands alone;
  // a maker with no mark has its name alone. Marks in assets/img/brands (see its NOTICE).
  var MAKERS = [
    [/^leica\b/i, "leica", "Leica", 1, /^leica(\s+camera(\s+ag)?)?\s*/i, "leica", true],
    [/^(apple\b|iphone|ipad)/i, "apple", "Apple", 0.818, /^apple\s*/i, "apple", true],
    [/^sony\b/i, "sony", "Sony", 5.277, /^sony\s*/i],
    [/^fuji(film)?\b/i, "fujifilm", "Fujifilm", 5.515, /^fuji(film)?\s*/i],
    [/^nikon\b/i, "nikon", "Nikon", 3.467, /^nikon(\s+corporation)?\s*/i],
    [/^(panasonic|lumix)\b/i, "panasonic", "Panasonic", 5.983, /^panasonic\s*/i],
    [/^(eastman\s+)?kodak\b/i, "kodak", "Kodak", 1.147, /^(eastman\s+)?kodak(\s+company)?\s*/i, "", true],
    [/^dji\b/i, "dji", "DJI", 1.676, /^dji\s*/i],
    [/^(google\b|pixel\b)/i, "google", "Google", 0.975, /^google\s*/i, "", true],
    [/^samsung\b/i, "samsung", "Samsung", 5.998, /^samsung\s*/i],
    [/^canon\b/i, "", "Canon", 0, /^canon\s*/i],
    [/^hasselblad\b/i, "hasselblad", "Hasselblad", 12.659, /^hasselblad\s*/i],
    [/^(olympus|om\s*system|om\s*digital)\b/i, "", "OM System", 0, /^(olympus(\s+corporation)?|om\s*(system|digital(\s+solutions)?))\s*/i],
    [/^ricoh\b/i, "", "Ricoh", 0, /^ricoh(\s+imaging(\s+company)?)?\s*/i],
    [/^pentax\b/i, "", "Pentax", 0, /^pentax\s*/i],
    [/^sigma\b/i, "", "Sigma", 0, /^sigma\s*/i]
  ];
  function makerOf(camera) {
    camera = strip(camera);
    for (var k = 0; k < MAKERS.length; k++) {
      var m = MAKERS[k];
      if (m[0].test(camera)) return { file: m[1], name: m[2], ar: m[3], model: strip(camera.replace(m[4], "")) || camera, type: m[5] || "", sym: !!m[6] };
    }
    return null;
  }
  // The camera as markup: the maker's mark in the ink colour and its name, then the model;
  // makerOnly leaves the model out. Unknown makers stay as text.
  function cameraHtml(camera, makerOnly) {
    var m = makerOf(camera);
    if (!m) return makerOnly ? "" : esc(camera);
    var named = !m.file || m.sym;
    var mark = m.file
      ? '<span class="gl-mark' + (m.ar > 2 ? " gl-mark--wide" : "") + '" data-maker="' + esc(m.file) + '"' +
        (named ? ' aria-hidden="true"' : ' role="img" aria-label="' + esc(m.name) + '"') +
        ' style="--mark:url(' + esc(base + "/assets/img/brands/" + m.file + ".svg") + ");--mark-ar:" + m.ar + '"></span>'
      : "";
    var name = named ? '<span class="gl-brand' + (m.type ? " gl-brand--" + m.type : "") + '">' + esc(m.name) + "</span>" : "";
    var maker = mark && name ? mark + " " + name : mark || name;
    return makerOnly ? maker : maker + ' <span class="gl-model">' + esc(m.model) + "</span>";
  }

  /* ---------- The close-up viewer ---------- */
  var dialog = document.querySelector("dialog.gl");
  var api = {
    photos: photos,
    still: still,
    esc: esc,
    label: label,
    metaLine: metaLine,
    specLine: specLine,
    altText: altText,
    cameraHtml: cameraHtml,
    open: function () {},
    go: function () {},
    onClose: null,
    onStep: null,
    onFill: null
  };
  window.Gallery = api;
  if (!dialog || typeof dialog.showModal !== "function" || !photos.length) return;

  var stage = dialog.querySelector(".gl__stage");
  var img = dialog.querySelector(".gl__img");
  var cap = dialog.querySelector(".gl__cap");
  var spec = dialog.querySelector(".gl__spec");
  var count = dialog.querySelector(".gl__count");
  var frameEl = dialog.querySelector(".gl__frame");
  var roll = dialog.querySelector(".gl__roll");
  // The roll: every photograph as a frame on a strip of film, to jump to.
  if (roll) {
    roll.innerHTML = photos.map(function (p) {
      var n = (p.i + 1 < 10 ? "0" : "") + (p.i + 1);
      return '<li><button class="gl__frm" type="button" data-gl-i="' + p.i + '" aria-label="' + esc(label(p)) + '">' +
        '<img src="' + esc(p.thumb) + '" alt="" loading="lazy" decoding="async" draggable="false" style="--ar:' + p.ar.toFixed(4) + '">' +
        '<span class="gl__edge" aria-hidden="true">' + n + "</span></button></li>";
    }).join("");
  }
  // (a touch listener is what lets an iPhone show the keys' pressed state)
  document.addEventListener("touchstart", function () {}, { passive: true });
  var index = 0, openedAt = 0, opener = null, closing = false, markedI = -1;
  // Which pictures are here already: a step shows the full photograph if it has come,
  // else its small print (sharpened once the full one arrives), and never waits on the network.
  var got = Object.create(null), warming = Object.create(null);
  function abs(src) { try { return new URL(src, document.baseURI).href; } catch (e) { return src; } }
  function have(src) {
    var k = abs(src);
    if (got[k]) return true;
    var t = new Image();
    t.src = src;
    return !!(got[k] = t.complete && t.naturalWidth > 0);
  }
  function warm(src) {
    var k = abs(src);
    if (got[k] || warming[k]) return;
    var t = warming[k] = new Image();
    t.onload = function () { got[k] = true; delete warming[k]; if (t.decode) t.decode().catch(function () {}); };
    t.onerror = function () { delete warming[k]; };
    t.src = src;
  }
  // the photographs either side in full, a little further their small prints
  function warmAround(i) {
    var N = photos.length;
    [1, -1, 2, -2].forEach(function (k) {
      var q = photos[((i + k) % N + N) % N];
      if (k === 1 || k === -1) warm(q.src);
      warm(q.thumb);
    });
  }
  // Focus is shown and handed back only to someone using the keyboard: after a tap or a
  // click, neither the Close key's ring nor the photograph's label should appear.
  var keyed = false;
  document.addEventListener("keydown", function () { keyed = true; }, true);
  document.addEventListener("pointerdown", function () { keyed = false; }, true);

  function fill(i, fromSrc) {
    var p = photos[i];
    img.style.setProperty("--ar", p.ar);
    stage.style.setProperty("--ar", p.ar);
    img.alt = altText(p);
    img.src = fromSrc || p.src;
    if (fromSrc && fromSrc !== p.src) {
      var pre = new Image();
      pre.onload = function () { got[abs(p.src)] = true; if (index === i && dialog.open) img.src = p.src; };
      pre.src = p.src;
    }
    var meta = metaLine(p);
    cap.innerHTML = '<p class="gl__title">' + esc(label(p)) + "</p>" + (meta ? '<p class="gl__meta">' + esc(meta) + "</p>" : "");
    var rows = specRows(p);
    spec.innerHTML = rows.map(function (r) { return '<div data-k="' + esc(r[0].toLowerCase().replace(/\s+/g, "-")) + '"><dt>' + esc(r[0]) + "</dt><dd>" + (r[0] === "Camera" ? cameraHtml(r[1]) : esc(r[1])) + "</dd></div>"; }).join("");
    spec.classList.toggle("is-empty", !rows.length);
    mark(i);
    if (api.onFill) api.onFill(i, p, dialog.open);
    warmAround(i);
  }
  // the counter and the roll show photograph i: at once when a step begins, not when it lands
  function mark(i) {
    if (i === markedI) return;
    markedI = i;
    count.textContent = (i + 1) + " / " + photos.length;
    if (roll) {
      Array.prototype.forEach.call(roll.querySelectorAll(".gl__frm"), function (b) {
        var on = +b.getAttribute("data-gl-i") === i;
        b.classList.toggle("is-on", on);
        if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      });
      if (dialog.open) centre(i, true);
    }
  }

  // Opening and closing move as an app does on a phone: the close-up grows out of the
  // photograph's place on the wall (the dark window as a rounded rectangle, the photograph
  // in it) on a spring, and closing shrinks it back into that place. Where the browser
  // can draw a spring curve it is one; otherwise a gentle overshoot.
  var SPRING = window.CSS && CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)")
    ? "linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001 85.9%, 1)"
    : "cubic-bezier(.3, 1.12, .4, 1)";
  var home = null;   // where the photograph came from on the wall
  function rectOf(from) {
    var r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : from && from.width ? from : null;
    return r && r.width ? { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height, width: r.width, height: r.height } : null;
  }
  function window_(r, radius) {
    var w = window.innerWidth, h = window.innerHeight;
    return "inset(" + r.top.toFixed(1) + "px " + (w - r.right).toFixed(1) + "px " + (h - r.bottom).toFixed(1) + "px " + r.left.toFixed(1) + "px round " + radius + "px)";
  }
  function flip(r0, r1) {
    var dx = (r0.left + r0.width / 2) - (r1.left + r1.width / 2), dy = (r0.top + r0.height / 2) - (r1.top + r1.height / 2);
    return "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + (r0.width / r1.width).toFixed(4) + ")";
  }
  api.open = function (i, from, focusBack, fromSrc) {
    index = openedAt = i;
    opener = focusBack || (from && from.focus ? from : null);
    closing = false;
    home = from || null;
    fill(i, fromSrc);
    dialog.showModal();
    // when it opened: the click of the opening tap is not a tap in it (below)
    openT = performance.now();
    if (!keyed && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    root.classList.add("gl-open");
    if (roll) { measureRoll(); centre(i, false); }
    if (still() || !img.animate) return;
    var r0 = rectOf(from);
    img.style.opacity = "0";
    requestAnimationFrame(function () {
      img.style.opacity = "";
      var r1 = rectOf(img);
      if (!r0 || !r1) return;
      var D = 560;
      img.animate([{ transform: flip(r0, r1) }, { transform: "none" }], { duration: D, easing: SPRING });
      try { dialog.animate([{ clipPath: window_(r0, 14) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: D, easing: SPRING }); } catch (e) {}
      if (frameEl && frameEl.animate) frameEl.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], { duration: D, easing: "ease-out" });
    });
  };


  /* ---------- The film: drag it through the gate ---------- */
  // Only a scroll made by hand chooses a photograph: when the code itself glides the
  // film (the arrows, a frame clicked) it sets target, and passing frames choose nothing.
  var gate = dialog.querySelector(".gl__gate");
  // the surfaces that turn (the wound film, the knob's knurling) slide their pattern; the
  // roll on the reel thickens; the mark on the cassette's knob goes round
  var turners = Array.prototype.map.call(dialog.querySelectorAll("[data-scroll]"), function (el) {
    return { el: el, k: +el.getAttribute("data-scroll") || 1, period: +el.getAttribute("width") || 10 };
  });
  var winds = Array.prototype.slice.call(dialog.querySelectorAll("[data-wind]"));
  var ticks = Array.prototype.map.call(dialog.querySelectorAll("[data-tick]"), function (el) {
    var v = el.getAttribute("data-tick").split(" ");
    return { el: el, cx: +v[0], r: +v[1], w: +el.getAttribute("width") || 1 };
  });
  var lis = roll ? Array.prototype.slice.call(roll.children) : [];
  var mids = [], wides = [], target = -1, armed = false, fingers = 0, settleT = 0, nearI = -1, filmRaf = 0, rollQuiet = 0, md = null;
  // how far the finger travelled along the film: a deliberate swipe always moves at least one frame
  var swipeFrom = 0, swipeDx = 0;
  var hasScrollEnd = "onscrollend" in window;
  function measureRoll() {
    if (!roll || !lis.length) return;
    var w = roll.clientWidth;
    roll.style.paddingLeft = Math.max(0, (w - lis[0].offsetWidth) / 2).toFixed(1) + "px";
    roll.style.paddingRight = Math.max(0, (w - lis[lis.length - 1].offsetWidth) / 2).toFixed(1) + "px";
    mids = lis.map(function (li) { return li.offsetLeft + li.offsetWidth / 2; });
    wides = lis.map(function (li) { return li.offsetWidth; });
  }
  function nearest() {
    var mid = roll.scrollLeft + roll.clientWidth / 2, best = 0, bd = Infinity;
    for (var k = 0; k < mids.length; k++) { var d = Math.abs(mids[k] - mid); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  // Put frame i in the gate: glide there, or jump.
  function centre(i, smooth) {
    if (!roll || !mids.length) return;
    var left = Math.max(0, mids[i] - roll.clientWidth / 2);
    if (Math.abs(left - roll.scrollLeft) < 1) { target = -1; filmMoved(); return; }
    target = i;
    armed = false;
    roll.scrollTo({ left: left, behavior: smooth && !still() ? "smooth" : "auto" });
    if (!smooth || still()) filmMoved();
  }
  // The film has moved: turn the reel and the spool, wind the film on, size the gate.
  function filmMoved() {
    filmRaf = 0;
    if (!roll || !mids.length) return;
    var x = roll.scrollLeft, max = Math.max(1, roll.scrollWidth - roll.clientWidth), mid = x + roll.clientWidth / 2;
    turners.forEach(function (o) { o.el.setAttribute("patternTransform", "translate(" + (-((x * o.k) % o.period)).toFixed(2) + " 0)"); });
    var ww = 12 + 22 * Math.min(1, x / max);
    winds.forEach(function (el) { el.setAttribute("x", (22 - ww / 2).toFixed(2)); el.setAttribute("width", ww.toFixed(2)); });
    ticks.forEach(function (o) {
      var a = x / 9;
      o.el.setAttribute("x", (o.cx + o.r * Math.sin(a) - o.w / 2).toFixed(2));
      o.el.style.opacity = Math.cos(a) > 0 ? "1" : "0";
    });
    // the gate takes the width of the frame in it, eased between neighbours
    var k = 0;
    while (k < mids.length - 1 && mids[k + 1] < mid) k++;
    var w = wides[k];
    if (k < mids.length - 1 && mid > mids[k]) { var t = (mid - mids[k]) / (mids[k + 1] - mids[k]); w = wides[k] + (wides[k + 1] - wides[k]) * Math.min(1, t); }
    if (gate) gate.style.setProperty("--gate-w", (w + 8).toFixed(1) + "px");
    var n = nearest();
    if (n !== nearI) {
      if (lis[nearI]) lis[nearI].firstElementChild.classList.remove("is-near");
      nearI = n;
      lis[n].firstElementChild.classList.add("is-near");
    }
  }
  // The film has stopped: if it was moved by hand, the frame in the gate is the photograph.
  function settle() {
    clearTimeout(settleT);
    if (!dialog.open || fingers > 0 || md) return;
    var k = nearest();
    if (armed) {
      armed = false;
      if (k === index && Math.abs(swipeDx) > 24) k = Math.max(0, Math.min(photos.length - 1, index + (swipeDx > 0 ? 1 : -1)));
      swipeDx = 0;
      if (k !== index) api.go(k);
      return;
    }
    if (target >= 0 && k === target) target = -1;
  }
  function byHand() { armed = true; target = -1; }
  if (roll) {
    roll.addEventListener("scroll", function () {
      if (!filmRaf) filmRaf = requestAnimationFrame(filmMoved);
      clearTimeout(settleT);
      if (!hasScrollEnd) settleT = setTimeout(settle, 150);
    }, { passive: true });
    if (hasScrollEnd) roll.addEventListener("scrollend", settle);
    roll.addEventListener("touchstart", function (e) { fingers = e.touches.length; byHand(); swipeFrom = e.touches[0].clientX; swipeDx = 0; }, { passive: true });
    roll.addEventListener("touchmove", function (e) { if (e.touches.length === 1) swipeDx = swipeFrom - e.touches[0].clientX; }, { passive: true });
    var lift = function (e) { fingers = e.touches.length; if (!fingers) { clearTimeout(settleT); settleT = setTimeout(settle, 180); } };
    roll.addEventListener("touchend", lift, { passive: true });
    roll.addEventListener("touchcancel", lift, { passive: true });
    // A mouse wheel turns the film a frame a notch; a trackpad's sideways swipe drags it.
    var wheelAt = 0;
    roll.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        var now = performance.now();
        if (now - wheelAt > 260) { wheelAt = now; step(e.deltaY > 0 ? 1 : -1); }
      } else byHand();
    }, { passive: false });
    // With a mouse the film is dragged by hand too; let go, it glides to the nearest frame.
    roll.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button > 0) return;
      md = { id: e.pointerId, x: e.clientX, left: roll.scrollLeft, moved: false };
    });
    roll.addEventListener("pointermove", function (e) {
      if (!md || e.pointerId !== md.id) return;
      var dx = e.clientX - md.x;
      if (!md.moved) {
        if (Math.abs(dx) < 5) return;
        md.moved = true;
        byHand();
        roll.style.scrollSnapType = "none";
        try { roll.setPointerCapture(e.pointerId); } catch (x) {}
      }
      roll.scrollLeft = md.left - dx;
    });
    var mouseUp = function (e) {
      if (!md || e.pointerId !== md.id) return;
      var was = md;
      md = null;
      if (!was.moved) return;
      rollQuiet = performance.now() + 400;
      var k = nearest(), dx = was.left - roll.scrollLeft;
      if (k === index && Math.abs(dx) > 24) k = Math.max(0, Math.min(photos.length - 1, index + (dx < 0 ? 1 : -1)));
      armed = true;
      roll.scrollTo({ left: Math.max(0, mids[k] - roll.clientWidth / 2), behavior: still() ? "auto" : "smooth" });
      setTimeout(function () { roll.style.scrollSnapType = ""; if (armed) settle(); }, 450);
    };
    roll.addEventListener("pointerup", mouseUp);
    roll.addEventListener("pointercancel", mouseUp);
    // the click a mouse drag ends with is not a click on a frame
    roll.addEventListener("click", function (e) {
      if (performance.now() < rollQuiet) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    window.addEventListener("resize", function () { if (dialog.open) { measureRoll(); centre(index, false); } });
  }

  // Closing: back into the photograph's place on the wall when it is the one that was
  // opened (the wall has not moved), else a short fade; quick (after a swipe down) fades.
  function close(quick) {
    if (!dialog.open || closing) return;
    if (still() || !dialog.animate) { dialog.close(); return; }
    closing = true;
    var r0 = !quick && index === openedAt ? rectOf(home) : null, r1 = rectOf(img), D = 380, E = "cubic-bezier(.4, 0, .2, 1)", last;
    if (r0 && r1 && img.animate) {
      img.animate([{ transform: "none" }, { transform: flip(r0, r1) }], { duration: D, easing: E, fill: "forwards" });
      rest().forEach(function (c) { if (c.animate) c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" }); });
      if (frameEl && frameEl.animate) frameEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
      try {
        last = dialog.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: window_(r0, 14) }], { duration: D, easing: E, fill: "forwards" });
        dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D, easing: E, fill: "forwards", pseudoElement: "::backdrop" });
      } catch (e) {}
    }
    if (!last) last = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" });
    last.onfinish = function () { dialog.close(); };
  }
  // after closing, nothing of the closing movement is left for the next opening
  function settleClosed() {
    [dialog, img, frameEl].concat(rest()).forEach(function (el) {
      if (el && el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); });
    });
  }
  function step(d) { go((index + d + photos.length) % photos.length, d); }
  api.go = function (n) { if (dialog.open && n !== index) go(n, n > index ? 1 : -1); };
  /* ---------- Paging, as in a phone's photo album ---------- */
  // Sideways the photographs lie side by side, a gap apart: a drag moves them with the
  // finger, the next coming in from the side, and let go they glide on to it or back. The
  // arrows, the keys and the roll slide the same way, and every tap is answered at once:
  // a quick run of taps keeps gliding. Nothing fades: the photograph arriving moves once
  // it is drawn (its small print if the full one has not come; it sharpens on arrival),
  // and takes the main place only once it shows.
  var GAP = 28, EASE = "cubic-bezier(.25,.8,.25,1)", slide = null, goTok = 0;
  var Matrix = window.DOMMatrix || window.WebKitCSSMatrix;
  // photograph n as a picture beside the one shown: in full if it has come, else its small print
  function sideOf(n) {
    var p = photos[n], el = document.createElement("img");
    el.className = "gl__img gl__img--side";
    el.alt = "";
    el.draggable = false;
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("--ar", p.ar);
    el._src = have(p.src) ? p.src : p.thumb;
    if (el._src !== p.src) warm(p.src);
    el.src = el._src;
    stage.insertBefore(el, img.nextSibling);
    return el;
  }
  // where a side photograph sits: a gap beyond the edge of ref (the one shown), on side d
  function offsetOf(el, d, ref) { return d * ((ref || img).getBoundingClientRect().width / 2 + GAP + el.getBoundingClientRect().width / 2); }
  function at(el, x) { el.style.transform = "translateX(" + x.toFixed(1) + "px)"; }
  // where a picture is at this moment, mid-glide or not
  function xOf(el) {
    var t = getComputedStyle(el).transform;
    if (!t || t === "none" || !Matrix) return 0;
    try { return new Matrix(t).m41; } catch (e) { return 0; }
  }
  // The frame lines stay up while the photographs move, as a viewfinder's do: the frame
  // eases from the size of the photograph leaving to the size of the one arriving, with the
  // finger while dragging and with the glide after.
  var frameAnim = null;
  function sizeOf(el) { var r = el.getBoundingClientRect(); return [r.width, r.height]; }
  function box(z) { return { width: z[0].toFixed(1) + "px", height: z[1].toFixed(1) + "px" }; }
  // the frame held at size z, or (no z) back to the size its photograph gives it
  function frameSize(z) {
    if (!frameEl) return;
    if (frameAnim) { frameAnim.cancel(); frameAnim = null; }
    frameEl.style.width = z ? box(z).width : "";
    frameEl.style.height = z ? box(z).height : "";
  }
  // the frame easing from wherever it is to size z
  function frameTo(z, opt, then) {
    if (!frameEl || !frameEl.animate) { if (then) then(); return; }
    var from = sizeOf(frameEl);
    frameSize(z);
    frameAnim = frameEl.animate([box(from), box(z)], opt);
    if (then) frameAnim.onfinish = then;
  }
  // the slide under way, finished at once: its photograph shown, nothing left over
  function endSlide() { if (slide) slide.done(); }
  // Glide so that el (photograph n) lands in the middle, everything else moving with it by
  // the same distance; from holds where the shown one, el and the others start.
  function glide(n, el, others, from) {
    var shift = -from[1], dur = Math.max(240, Math.min(440, Math.abs(shift) * 0.85));
    var tx = function (x) { return { transform: "translateX(" + x.toFixed(1) + "px)" }; };
    var moving = [img, el].concat(others);
    if (slide) slide.drop();
    frameTo(sizeOf(el), { duration: dur, easing: EASE });
    var anims = moving.map(function (m, k) { return m.animate([tx(from[k]), tx(from[k] + shift)], { duration: dur, easing: EASE, fill: "forwards" }); });
    var s = { n: n, el: el, others: others, over: false };
    // let go of this slide without finishing it: the next one takes its pictures over
    s.drop = function () {
      s.over = true;
      if (slide === s) slide = null;
      anims.forEach(function (a) { a.cancel(); });
    };
    s.done = function () {
      if (s.over) return;
      s.over = true;
      if (slide === s) slide = null;
      fill(n, el._src);
      frameSize();
      at(el, 0);
      img.style.transform = "";
      anims.forEach(function (a) { a.cancel(); });
      others.forEach(function (o) { o.remove(); });
      var drop = function () { el.remove(); };
      if (img.decode) img.decode().then(drop, drop); else drop();
    };
    slide = s;
    anims[0].onfinish = s.done;
  }
  function go(n, d) {
    if (api.onStep) api.onStep(n);
    index = n;
    var tok = ++goTok;
    mark(n);
    warmAround(n);
    if (still() || !img.animate) { endSlide(); fill(n); return; }
    var s = slide, el = sideOf(n);
    // A step while one is still gliding runs on from where everything is: the photograph
    // arriving is where the next one is measured from, and nothing jumps.
    if (s) {
      var xs = [img, s.el].concat(s.others).map(xOf);
      var cx = xs[1] + offsetOf(el, d, s.el);
      glide(n, el, [s.el].concat(s.others), [xs[0], cx].concat(xs.slice(1)));
      return;
    }
    // out at its side at once, never over the photograph shown while it is drawn
    var off = offsetOf(el, d), begun = false;
    at(el, off);
    var start = function () {
      if (begun) return;
      begun = true;
      if (tok !== goTok || !dialog.open) { el.remove(); return; }
      glide(n, el, [], [0, off]);
    };
    // decoded first so it never arrives blank, but a tap is answered within a moment either way
    if (el.decode) { el.decode().then(start, start); setTimeout(start, 120); } else start();
  }

  dialog.addEventListener("click", function (e) {
    var frm = e.target.closest("[data-gl-i]");
    if (frm) { api.go(+frm.getAttribute("data-gl-i")); return; }
    var act = e.target.closest("[data-gl]");
    if (act) {
      var a = act.getAttribute("data-gl");
      if (a === "prev") step(-1);
      else if (a === "next") step(1);
      else close();
      return;
    }
    // a tap or click on the photograph, or the black round it, goes back to the wall
    if (e.target === dialog || e.target === stage || e.target === img) close();
  });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  });
  dialog.addEventListener("cancel", function (e) {
    if (!still()) { e.preventDefault(); close(); }
  });
  // One gesture on the photograph, its direction settled after the first few pixels:
  // sideways steps to the next or the previous one; on a touch screen, down takes it
  // away, as a phone's photo viewer does: it follows the finger and shrinks a little,
  // everything else fades, and let go far or fast enough it leaves, else it springs back.
  var g = null, quietUntil = 0, openT = -1e9;
  function rest() { return Array.prototype.filter.call(dialog.children, function (c) { return c !== stage; }); }
  function pull(dy, p, bg) {
    stage.style.transform = dy ? "translateY(" + dy.toFixed(1) + "px) scale(" + (1 - p * 0.14).toFixed(4) + ")" : "";
    rest().forEach(function (c) { c.style.opacity = p ? (1 - p).toFixed(3) : ""; });
    dialog.style.backgroundColor = p && bg ? "rgba(" + bg + "," + (1 - p * 0.8).toFixed(3) + ")" : "";
  }
  function unpull() {
    pull(0, 0);
    if (stage.getAnimations) stage.getAnimations().forEach(function (a) { a.cancel(); });
  }
  // The click a drag on the photograph ends with is not a tap: it must not close the
  // close-up. Nor is the click of the tap that opened it, which some phones send a moment
  // later to whatever is now under the finger. The keys below answer every real tap.
  dialog.addEventListener("click", function (e) {
    var now = performance.now(), sinceOpen = now - openT, keys = e.target.closest && e.target.closest(".gl__controls, .gl__info");
    if (sinceOpen < 120 || (!keys && (sinceOpen < 450 || now < quietUntil))) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  stage.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || closing || g) return;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(dialog).backgroundColor);
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: "", touch: e.pointerType !== "mouse",
      dy: 0, v: 0, ly: e.clientY, lt: performance.now(), bg: m ? m[1] + "," + m[2] + "," + m[3] : "" };
  });
  stage.addEventListener("pointermove", function (e) {
    if (!g || e.pointerId !== g.id) return;
    var dx = e.clientX - g.x, dy = e.clientY - g.y, now = performance.now();
    if (!g.axis) {
      if (Math.hypot(dx, dy) < 10) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : dy > 0 && g.touch ? "down" : "none";
      // held only once it is a drag: a plain click keeps its own target (the photograph, or the black around it)
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
    }
    if (g.axis === "x") { pageMove(e, dx, now); return; }
    if (g.axis !== "down") return;
    // speed over the last moments, for a quick flick
    g.v = g.v * 0.4 + 0.6 * ((e.clientY - g.ly) / Math.max(1, now - g.lt));
    g.ly = e.clientY;
    g.lt = now;
    g.dy = Math.max(0, dy);
    if (!still()) pull(g.dy, Math.min(1, g.dy / (window.innerHeight * 0.55)), g.bg);
  });
  // A sideways drag: the photograph and its neighbours, each a gap apart, follow the finger.
  function pageMove(e, dx, now) {
    if (still() || photos.length < 2 || !img.animate) return;
    if (!g.pages) {
      endSlide();
      var N = photos.length, prev = sideOf((index - 1 + N) % N), next = sideOf((index + 1) % N);
      warmAround(index);
      prev._off = offsetOf(prev, -1);
      next._off = offsetOf(next, 1);
      g.pages = { prev: prev, next: next, w: img.getBoundingClientRect().width, f0: sizeOf(img), fp: sizeOf(prev), fn: sizeOf(next) };
      g.vx = 0; g.lx = e.clientX; g.lt = now;
    }
    g.vx = g.vx * 0.4 + 0.6 * ((e.clientX - g.lx) / Math.max(1, now - g.lt));
    g.lx = e.clientX;
    g.lt = now;
    g.dx = dx;
    img.style.transform = "translateX(" + dx.toFixed(1) + "px)";
    at(g.pages.prev, g.pages.prev._off + dx);
    at(g.pages.next, g.pages.next._off + dx);
    // the frame takes on the shape of the photograph coming in, as far as it has come
    var P = g.pages, side = dx < 0 ? P.next : P.prev, f1 = dx < 0 ? P.fn : P.fp, t = Math.min(1, Math.abs(dx) / Math.max(1, Math.abs(side._off)));
    frameSize([P.f0[0] + (f1[0] - P.f0[0]) * t, P.f0[1] + (f1[1] - P.f0[1]) * t]);
  }
  // Let go: on to the neighbour when dragged a fifth of the way or flicked, else back.
  function pageEnd(t, cancelled) {
    var P = t.pages;
    if (!P) return;
    var dx = t.dx || 0, d = dx < 0 ? 1 : -1, N = photos.length;
    var flick = Math.abs(t.vx) > 0.25 && (t.vx < 0 ? 1 : -1) === d;
    if (!cancelled && dx && (Math.abs(dx) > P.w * 0.2 || flick)) {
      var n = (index + d + N) % N, el = d > 0 ? P.next : P.prev, other = d > 0 ? P.prev : P.next;
      if (api.onStep) api.onStep(n);
      index = n;
      ++goTok;
      mark(n);
      glide(n, el, [other], [dx, el._off + dx, other._off + dx]);
      return;
    }
    // back to where it was
    var tx = function (x) { return { transform: "translateX(" + x.toFixed(1) + "px)" }; }, opt = { duration: 260, easing: EASE };
    img.style.transform = "";
    img.animate([tx(dx), tx(0)], opt);
    [P.prev, P.next].forEach(function (o) {
      at(o, o._off);
      var a = o.animate([tx(o._off + dx), tx(o._off)], opt);
      a.onfinish = function () { o.remove(); };
    });
    frameTo(P.f0, opt, function () { frameSize(); });
  }
  function release(e, cancelled) {
    if (!g || e.pointerId !== g.id) return;
    var t = g, dx = e.clientX - t.x;
    g = null;
    if (t.axis) quietUntil = performance.now() + 400;
    if (t.axis === "x") { pageEnd(t, cancelled); return; }
    if (t.axis !== "down") return;
    if (!cancelled && (t.dy > 90 || (t.v > 0.6 && t.dy > 30))) {
      if (still() || !stage.animate) { unpull(); close(true); return; }
      var from = stage.style.transform;
      stage.animate([{ transform: from }, { transform: "translateY(" + (t.dy + window.innerHeight * 0.4).toFixed(0) + "px) scale(.78)" }],
        { duration: 260, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      close(true);
      return;
    }
    // not far enough: back into the frame
    if (still() || !stage.animate) { unpull(); return; }
    var was = stage.style.transform, p = Math.min(1, t.dy / (window.innerHeight * 0.55)), bgWas = dialog.style.backgroundColor;
    unpull();
    stage.animate([{ transform: was }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
    rest().forEach(function (c) { if (c.animate) c.animate([{ opacity: 1 - p }, { opacity: 1 }], { duration: 240, easing: "ease-out" }); });
    if (bgWas && dialog.animate) dialog.animate([{ backgroundColor: bgWas }, { backgroundColor: getComputedStyle(dialog).backgroundColor }], { duration: 240, easing: "ease-out" });
  }
  stage.addEventListener("pointerup", function (e) { release(e, false); });
  stage.addEventListener("pointercancel", function (e) { release(e, true); });
  dialog.addEventListener("close", function () {
    g = null;
    unpull();
    endSlide();
    ++goTok;
    markedI = -1;
    Array.prototype.forEach.call(stage.querySelectorAll(".gl__img--side"), function (el) { el.remove(); });
    img.style.transform = "";
    frameSize();
    settleClosed();
    closing = false;
    root.classList.remove("gl-open");
    if (api.onClose) api.onClose(index, index !== openedAt);
    if (opener && opener.focus && keyed) opener.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
})();
