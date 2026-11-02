/*
 * Slide night: the projector.
 * - Scrolling advances one slide per step: the shutter closes, the round tray
 *   turns one slot, the next slide drops into the gate out of focus and the
 *   lens finds it.
 * - Dust drifts in the beam between the projector and the wall.
 * - The light table below holds every slide; clicking one projects it.
 * - Reduced motion: slides change at once, the dust stays still.
 */
(function () {
  "use strict";
  var G = window.Gallery;
  var show = document.querySelector(".pj-show:not(.pj-show--empty)");
  if (!G || !show || !G.photos.length) return;

  var photos = G.photos, N = photos.length;
  var stage = show.querySelector(".pj-stage");
  var frame = stage.querySelector(".pj-frame");
  var img = frame.querySelector(".pj-img");
  var spill = frame.querySelector(".pj-spill");
  var beam = stage.querySelector(".pj-beam__cone");
  var dust = stage.querySelector(".pj-dust");
  var ring = stage.querySelector(".pj-tray__ring");
  var mountNo = stage.querySelector(".pj-mount__no");
  var mountMeta = stage.querySelector(".pj-mount__meta");
  var countEl = stage.querySelector("[data-pj-count]");
  var hint = stage.querySelector("[data-pj-hint]");
  var lookBtn = stage.querySelector('[data-pj="look"]');
  var tableSlides = Array.prototype.slice.call(document.querySelectorAll(".pj-slide"));
  var still = G.still;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- The tray: one slot per slide, numbered on the rim ---------- */
  var SLOTS = Math.max(N, 30), slots = [];
  for (var k = 0; k < SLOTS; k++) {
    var s = document.createElement("div");
    s.className = "pj-slot" + (k < N ? " is-loaded" : "");
    s.style.setProperty("--a", (k * 360 / SLOTS) + "deg");
    s.innerHTML = '<span class="pj-slot__mount"></span>' + (k % 2 === 0 ? '<span class="pj-slot__no">' + (k + 1) + "</span>" : "");
    ring.appendChild(s);
    slots.push(s);
  }
  function trayTo(i) {
    ring.style.setProperty("--rot", (-i * 360 / SLOTS) + "deg");
    slots.forEach(function (sl, n) { sl.classList.toggle("is-out", n === i); });
  }

  function setLabel(i) {
    var p = photos[i];
    mountNo.textContent = G.label(p);
    mountMeta.textContent = G.metaLine(p);
    countEl.textContent = (i + 1) + " / " + N;
    tableSlides.forEach(function (a, n) { a.classList.toggle("is-current", n === i); });
  }

  /* ---------- The beam follows the picture on the wall ---------- */
  var geo = { x0: 0, x1: 0, y0: 0, y1: 0, bx: 0, by: 0, w: 1, h: 1 };
  function beamGeo() {
    var sr = stage.getBoundingClientRect(), fr = frame.getBoundingClientRect();
    if (!sr.width) return;
    geo = {
      x0: fr.left - sr.left, x1: fr.right - sr.left, y0: fr.top - sr.top, y1: fr.bottom - sr.top,
      bx: sr.width * 0.5, by: sr.height * 1.06, w: sr.width, h: sr.height
    };
    beam.style.setProperty("--x0", (geo.x0 / sr.width * 100).toFixed(2) + "%");
    beam.style.setProperty("--x1", (geo.x1 / sr.width * 100).toFixed(2) + "%");
    beam.style.setProperty("--y0", (geo.y0 / sr.height * 100).toFixed(2) + "%");
    beam.style.setProperty("--y1", (geo.y1 / sr.height * 100).toFixed(2) + "%");
  }

  /* ---------- Dust in the beam ---------- */
  var ctx = dust.getContext ? dust.getContext("2d") : null;
  var motes = [], lamp = 1, visible = true, dpr = 1;
  function sizeDust() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    dust.width = Math.round(geo.w * dpr);
    dust.height = Math.round(geo.h * dpr);
  }
  function seedMotes() {
    var n = geo.w < 700 ? 70 : 150;
    motes = [];
    for (var i = 0; i < n; i++) {
      motes.push({
        x: Math.random() * geo.w,
        y: geo.y0 + Math.random() * (geo.by - geo.y0),
        r: 0.5 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.03 - Math.random() * 0.09,
        ph: Math.random() * Math.PI * 2
      });
    }
  }
  function drawDust(t) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, geo.w, geo.h);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(geo.bx, geo.by);
    ctx.lineTo(geo.x0, geo.y1);
    ctx.lineTo(geo.x0, geo.y0);
    ctx.lineTo(geo.x1, geo.y0);
    ctx.lineTo(geo.x1, geo.y1);
    ctx.closePath();
    ctx.clip();
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      if (!still()) {
        m.vx += (Math.random() - 0.5) * 0.006;
        m.vx = Math.max(-0.12, Math.min(0.12, m.vx));
        m.x += m.vx;
        m.y += m.vy;
        if (m.y < geo.y0 - 4) { m.y = geo.by; m.x = Math.random() * geo.w; }
        if (m.x < 0) m.x += geo.w;
        if (m.x > geo.w) m.x -= geo.w;
      }
      var near = (m.y - geo.y0) / Math.max(1, geo.by - geo.y0);
      var a = lamp * (0.18 + 0.55 * near) * (0.55 + 0.45 * Math.sin(t / 900 + m.ph));
      ctx.fillStyle = "rgba(255,236,204," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  var tracking = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!visible) return;
    if (tracking > 0) { beamGeo(); tracking--; }
    drawDust(t);
  }
  function layout() {
    beamGeo();
    sizeDust();
    seedMotes();
    drawDust(0);
  }
  layout();
  window.addEventListener("resize", function () { layout(); measure(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);
  }
  if (img.complete) beamGeo(); else img.addEventListener("load", beamGeo);
  requestAnimationFrame(loop);

  /* ---------- Changing slides ---------- */
  var cur = 0, want = 0, busy = false;
  var ready = {};
  function preload(i) {
    return new Promise(function (res) {
      if (ready[i]) { res(); return; }
      var im = new Image();
      im.onload = im.onerror = function () { ready[i] = true; res(); };
      im.src = photos[i].src;
    });
  }
  function swap(i) {
    var p = photos[i];
    frame.style.setProperty("--ar", p.ar);
    img.src = p.src;
    img.alt = G.altText(p);
    img.width = p.w;
    img.height = p.h;
    spill.src = p.thumb;
    setLabel(i);
  }
  function lampTo(v, ms) {
    var from = lamp, t0 = performance.now();
    return new Promise(function (res) {
      function f(now) {
        var k = Math.min(1, (now - t0) / ms);
        lamp = from + (v - from) * k;
        beam.style.opacity = String(0.25 + 0.75 * lamp);
        if (k < 1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
  }
  var shutter = null;
  async function project(i, first) {
    trayTo(i);
    await preload(i);
    if (still() || !frame.animate) { swap(i); tracking = 30; return; }
    if (!first) {
      // The shutter closes and the screen goes dark while the tray turns.
      lampTo(0.1, 140);
      shutter = frame.animate([{ filter: "brightness(1)" }, { filter: "brightness(0)" }], { duration: 150, easing: "ease-in", fill: "forwards" });
      await shutter.finished.catch(function () {});
      swap(i);
      tracking = 40;
      await wait(340);
    }
    // The lamp comes up on a slide out of focus; the lens hunts, then holds.
    lampTo(1, 260);
    var focus = frame.animate([
      { filter: "brightness(1.25) blur(10px)", transform: "translateY(-1.4%) scale(1.014)" },
      { filter: "brightness(1.04) blur(0px)", transform: "translateY(.25%) scale(1)", offset: 0.5 },
      { filter: "brightness(1) blur(1.8px)", transform: "translateY(0)", offset: 0.7 },
      { filter: "brightness(1) blur(0px)", transform: "none" }
    ], { duration: 820, easing: "cubic-bezier(.2,.7,.25,1)" });
    if (shutter) { shutter.cancel(); shutter = null; }
    await focus.finished.catch(function () {});
  }
  async function run() {
    if (busy) return;
    busy = true;
    try {
      while (want !== cur) {
        var dir = want > cur ? 1 : -1;
        var next = Math.abs(want - cur) > 2 ? want - dir : cur + dir;
        await project(next);
        cur = next;
      }
    } finally {
      busy = false;
    }
  }

  /* ---------- Scrolling: one step of the page per slide ---------- */
  var wrapTop = 0, stepPx = 1, queued = false;
  function measure() {
    wrapTop = show.getBoundingClientRect().top + window.pageYOffset;
    stepPx = N > 1 ? Math.max(1, (show.offsetHeight - window.innerHeight) / (N - 1)) : 1;
  }
  function indexFromScroll() {
    if (N < 2) return 0;
    return Math.max(0, Math.min(N - 1, Math.round((window.pageYOffset - wrapTop) / stepPx)));
  }
  function onScroll() {
    queued = false;
    var i = indexFromScroll();
    if (i !== want) { want = i; run(); }
    if (window.pageYOffset - wrapTop > stepPx * 0.25 && hint) hint.classList.add("is-gone");
  }
  window.addEventListener("scroll", function () {
    if (!queued) { queued = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  measure();

  function go(i) {
    i = Math.max(0, Math.min(N - 1, i));
    window.scrollTo({ top: wrapTop + i * stepPx + 1, behavior: still() ? "auto" : "smooth" });
  }

  stage.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pj]");
    if (!b) {
      if (e.target === img) G.open(cur, img, lookBtn);
      return;
    }
    var a = b.getAttribute("data-pj");
    if (a === "prev") go(want - 1);
    else if (a === "next") go(want + 1);
    else if (a === "look") G.open(cur, img, lookBtn);
  });
  tableSlides.forEach(function (a, i) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      go(i);
    });
  });
  document.addEventListener("keydown", function (e) {
    if (document.documentElement.classList.contains("gl-open") || e.altKey || e.ctrlKey || e.metaKey) return;
    var r = stage.getBoundingClientRect();
    if (r.bottom < 120 || r.top > 120) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(want + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(want - 1); }
  });
  G.onClose = function (i, moved) { if (moved) go(i); };

  /* ---------- First slide: the lamp warms up ---------- */
  setLabel(0);
  trayTo(0);
  want = cur = indexFromScroll();
  if (cur !== 0) { swap(cur); trayTo(cur); }
  ready[cur] = true;
  if (!still()) project(cur, true);
  if (hint) setTimeout(function () { hint.classList.add("is-gone"); }, 9000);
})();
