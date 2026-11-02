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
  var index = 0, openedAt = 0, opener = null, closing = false;
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
      pre.onload = function () { if (index === i && dialog.open) img.src = p.src; };
      pre.src = p.src;
    }
    var meta = metaLine(p);
    cap.innerHTML = '<p class="gl__title">' + esc(label(p)) + "</p>" + (meta ? '<p class="gl__meta">' + esc(meta) + "</p>" : "");
    var rows = specRows(p);
    spec.innerHTML = rows.map(function (r) { return '<div data-k="' + esc(r[0].toLowerCase().replace(/\s+/g, "-")) + '"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("");
    spec.hidden = !rows.length;
    count.textContent = (i + 1) + " / " + photos.length;
    if (roll) {
      Array.prototype.forEach.call(roll.querySelectorAll(".gl__frm"), function (b) {
        var on = +b.getAttribute("data-gl-i") === i;
        b.classList.toggle("is-on", on);
        if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      });
      if (dialog.open) centre(i, true);
    }
    if (api.onFill) api.onFill(i, p);
    [i + 1, i - 1].forEach(function (k) {
      var n = new Image();
      n.src = photos[(k + photos.length) % photos.length].src;
    });
  }

  api.open = function (i, from, focusBack, fromSrc) {
    index = openedAt = i;
    opener = focusBack || (from && from.focus ? from : null);
    closing = false;
    fill(i, fromSrc);
    dialog.showModal();
    if (!keyed && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    root.classList.add("gl-open");
    if (roll) { measureRoll(); centre(i, false); }
    if (still() || !img.animate) return;
    var r0 = null;
    if (from && from.getBoundingClientRect) r0 = from.getBoundingClientRect();
    else if (from && from.width) r0 = from;
    img.style.opacity = "0";
    requestAnimationFrame(function () {
      img.style.opacity = "";
      var r1 = img.getBoundingClientRect();
      if (!r0 || !r0.width || !r1.width) return;
      var dx = (r0.left + r0.width / 2) - (r1.left + r1.width / 2);
      var dy = (r0.top + r0.height / 2) - (r1.top + r1.height / 2);
      var s = r0.width / r1.width;
      img.animate([
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")" },
        { transform: "translateY(-1rem) scale(1.03) rotateX(5deg)", offset: 0.62 },
        { transform: "none" }
      ], { duration: 760, easing: "cubic-bezier(.2,.75,.25,1)" });
      focusPull(520);
    });
  };
  // The frame lines close in and the photograph comes into focus, as a lens does.
  function focusPull(delay) {
    if (still() || !img.animate) return;
    img.animate([{ filter: "blur(9px)" }, { filter: "blur(9px)", offset: 0.35 }, { filter: "blur(0)" }],
      { duration: delay + 380, easing: "cubic-bezier(.3,.7,.2,1)" });
    if (frameEl && frameEl.animate) {
      frameEl.animate([{ opacity: 0, transform: "scale(1.08)" }, { opacity: 0, transform: "scale(1.08)", offset: 0.45 }, { opacity: 1, transform: "none" }],
        { duration: delay + 300, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }

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

  function close() {
    if (!dialog.open || closing) return;
    if (still() || !dialog.animate) { dialog.close(); return; }
    closing = true;
    var a = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" });
    a.onfinish = function () { dialog.close(); };
  }
  function step(d) { go((index + d + photos.length) % photos.length, d); }
  api.go = function (n) { if (dialog.open && n !== index) go(n, n > index ? 1 : -1); };
  function go(n, d) {
    if (api.onStep) api.onStep(n);
    if (still() || !img.animate) { index = n; fill(n); return; }
    var out = img.animate([
      { transform: "none", opacity: 1 },
      { transform: "translateX(" + (-d * 4) + "%)", opacity: 0 }
    ], { duration: 160, easing: "ease-in", fill: "forwards" });
    out.onfinish = function () {
      index = n;
      fill(n);
      out.cancel();
      img.animate([
        { transform: "translateX(" + (d * 4) + "%)", opacity: 0 },
        { transform: "none", opacity: 1 }
      ], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
      focusPull(120);
    };
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
  var g = null, quietUntil = 0;
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
  // the click a drag ends with is not a tap: it must not close the close-up
  dialog.addEventListener("click", function (e) {
    if (performance.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); }
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
    if (g.axis !== "down") return;
    // speed over the last moments, for a quick flick
    g.v = g.v * 0.4 + 0.6 * ((e.clientY - g.ly) / Math.max(1, now - g.lt));
    g.ly = e.clientY;
    g.lt = now;
    g.dy = Math.max(0, dy);
    if (!still()) pull(g.dy, Math.min(1, g.dy / (window.innerHeight * 0.55)), g.bg);
  });
  function release(e, cancelled) {
    if (!g || e.pointerId !== g.id) return;
    var t = g, dx = e.clientX - t.x;
    g = null;
    if (t.axis) quietUntil = performance.now() + 400;
    if (t.axis === "x") { if (!cancelled && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); return; }
    if (t.axis !== "down") return;
    if (!cancelled && (t.dy > 90 || (t.v > 0.6 && t.dy > 30))) {
      if (still() || !stage.animate) { unpull(); close(); return; }
      var from = stage.style.transform;
      stage.animate([{ transform: from }, { transform: "translateY(" + (t.dy + window.innerHeight * 0.4).toFixed(0) + "px) scale(.78)" }],
        { duration: 260, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      close();
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
    closing = false;
    root.classList.remove("gl-open");
    if (api.onClose) api.onClose(index, index !== openedAt);
    if (opener && opener.focus && keyed) opener.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
})();
