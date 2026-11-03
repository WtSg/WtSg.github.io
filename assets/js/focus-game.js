/*
 * The focus challenge, opened from the close-up on the wall. A rangefinder camera with a
 * 50 mm f/2 lens sits on a dark table. Through its finder the photograph is the scene, and in
 * the bright patch in the middle a second image of it lies beside the first: turning the
 * lens's focus ring slides that image across, and where the two become one the lens is
 * focused on the subject. Five rounds, eight seconds each, a subject at a hidden distance
 * every time; release the shutter (or let the time run out) and the round says how close it
 * was. The camera is a design of its own: no maker's name or mark.
 */
import * as THREE from "three";

const ROUNDS = 5;
const ROUND_MS = 8000;
const NEAR = 0.7;                      // the lens focuses from 0.7 m to infinity
const INV_MAX = 1 / NEAR;              // in dioptres (1 / metres)
const A_MAX = 2.6;                     // the focus ring's travel, infinity to 0.7 m, radians
const F_MM = 50, N_STOP = 2, COC = 0.03;
// the ring turns in proportion to 1 / distance, as a real distance scale is laid out
const angOf = (inv) => (inv / INV_MAX) * A_MAX;
const invOf = (a) => (a / A_MAX) * INV_MAX;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// How sharp a round was: the blur circle on the film (mm) from the focus error, for this
// lens; within 0.03 mm a 35 mm frame counts as sharp.
function blurMm(err) { return ((F_MM * F_MM) / N_STOP) * (err / 1000); }
// How close the two images came together, as a percentage: 100 when they are one, about
// 80 at the edge of the depth of field, falling off beyond it.
function accuracy(err) { return 100 * Math.exp(-err / 0.1); }
function verdict(c) {
  if (c <= COC / 2) return "Critically sharp";
  if (c <= COC) return "Sharp";
  if (c <= COC * 3) return "Soft";
  return "Missed";
}
function metres(m) {
  if (!isFinite(m)) return "∞";
  return m >= 10 ? m.toFixed(1) + " m" : m.toFixed(2) + " m";
}
function gap(cm) { return cm < 100 ? Math.round(cm) + " cm" : (cm / 100).toFixed(2) + " m"; }

export function start(o) {
  const host = o.host, photos = o.photos || [], still = !!o.still;
  let closed = false;

  /* ---------- The page ---------- */
  const root = document.createElement("div");
  root.className = "fg";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Focus challenge");
  root.tabIndex = -1;
  root.innerHTML =
    '<div class="fg__finder"><canvas class="fg__vf" aria-hidden="true"></canvas></div>' +
    '<div class="fg__cam"><canvas class="fg__gl" role="img" aria-label="The camera. Drag across the lens, scroll, or use the left and right arrow keys to turn its focus ring."></canvas>' +
    '<p class="fg__how" aria-hidden="true">Drag the ring</p></div>' +
    '<header class="fg__top"><p class="fg__title">Focus challenge</p><p class="fg__round" aria-live="polite"></p>' +
    '<div class="fg__clock" aria-hidden="true"><b class="fg__secs">8.0</b><span class="fg__bar"><i></i></span></div>' +
    '<button class="fg__x" type="button" aria-label="Back to the photograph"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></header>' +
    '<div class="fg__foot"><p class="fg__hint"></p><button class="fg__go" type="button">Release</button></div>' +
    '<section class="fg__card" aria-live="polite" hidden></section>';
  host.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const vf = $(".fg__vf"), gl = $(".fg__gl"), roundEl = $(".fg__round"), secsEl = $(".fg__secs"), barEl = $(".fg__bar i");
  const hintEl = $(".fg__hint"), goBtn = $(".fg__go"), card = $(".fg__card"), howEl = $(".fg__how");
  // Nothing in here reaches the close-up underneath: its clicks, swipes, pinches and wheel.
  ["click", "dblclick", "pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "touchstart", "touchmove", "touchend", "gesturestart", "gesturechange", "gestureend", "contextmenu"].forEach((t) =>
    root.addEventListener(t, (e) => e.stopPropagation()));

  /* ---------- The photographs: this one first, then four others ---------- */
  const order = [o.index | 0];
  const rest = photos.map((_, i) => i).filter((i) => i !== (o.index | 0));
  for (let k = rest.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [rest[k], rest[j]] = [rest[j], rest[k]]; }
  while (order.length < ROUNDS && rest.length) order.push(rest.shift());
  while (order.length < ROUNDS) order.push(order[order.length % Math.max(1, order.length)]);
  const pics = order.map((i) => ({ p: photos[i], img: null, full: false, at: null }));
  function loadPic(k) {
    const pc = pics[k];
    if (!pc || pc.img) return;
    const thumb = new Image();
    thumb.decoding = "async";
    thumb.onload = () => { if (!pc.full) { pc.img = thumb; pc.at = pc.at || detail(thumb); if (k === round) need = true; } };
    thumb.src = pc.p.thumb;
    const big = new Image();
    big.decoding = "async";
    big.onload = () => { pc.img = big; pc.full = true; pc.at = pc.at || detail(big); if (k === round) need = true; };
    big.src = pc.p.src;
  }
  // Where in a photograph the patch has something to line up: the strongest run of upright
  // edges (a rangefinder compares sideways), in the middle part of the picture.
  function detail(img) {
    const S = 96, ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1.5;
    const w = S, h = Math.max(8, Math.round(S / ar));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    try {
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
      for (let k = 0; k < w * h; k++) L[k] = 0.3 * d[k * 4] + 0.59 * d[k * 4 + 1] + 0.11 * d[k * 4 + 2];
      const E = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 1; x < w - 1; x++) E[y * w + x] = Math.abs(L[y * w + x + 1] - L[y * w + x - 1]);
      const bw = Math.max(2, Math.round(w * 0.12)), bh = Math.max(2, Math.round(h * 0.1));
      let best = -1, bx = w / 2, by = h / 2;
      for (let y = Math.round(h * 0.28); y <= Math.round(h * 0.72) - bh; y++) {
        for (let x = Math.round(w * 0.28); x <= Math.round(w * 0.72) - bw; x++) {
          let s = 0;
          for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) s += E[yy * w + xx];
          if (s > best) { best = s; bx = x + bw / 2; by = y + bh / 2; }
        }
      }
      return { u: bx / w, v: by / h };
    } catch (e) {
      return { u: 0.5, v: 0.5 };
    }
  }

  /* ---------- The finder ---------- */
  const vg = vf.getContext("2d");
  let vw = 1, vh = 1, dpr = 1;
  function drawFinder() {
    const W = vf.width, H = vf.height;
    vg.setTransform(1, 0, 0, 1, 0, 0);
    vg.fillStyle = "#000";
    vg.fillRect(0, 0, W, H);
    const m = Math.round(Math.min(W, H) * 0.035), r = Math.min(W, H) * 0.05;
    const wx = m, wy = m, ww = W - 2 * m, wh = H - 2 * m;
    const pc = pics[round], img = pc && pc.img;
    vg.save();
    vg.beginPath();
    vg.roundRect ? vg.roundRect(wx, wy, ww, wh, r) : vg.rect(wx, wy, ww, wh);
    vg.clip();
    vg.fillStyle = "#14130f";
    vg.fillRect(wx, wy, ww, wh);
    let place = null;
    if (img) {
      // the photograph as the scene, a little closer than the whole frame, its detail behind the patch
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.max(ww / iw, wh / ih) * 1.5, dw = iw * s, dh = ih * s, at = pc.at || { u: 0.5, v: 0.5 };
      const ox = clamp(wx + ww / 2 - at.u * dw, wx + ww - dw, wx), oy = clamp(wy + wh / 2 - at.v * dh, wy + wh - dh, wy);
      place = { ox, oy, dw, dh };
      vg.drawImage(img, ox, oy, dw, dh);
    }
    // a finder is a little darker towards its edges
    const vgn = vg.createRadialGradient(W / 2, H / 2, Math.min(ww, wh) * 0.3, W / 2, H / 2, Math.hypot(ww, wh) * 0.62);
    vgn.addColorStop(0, "rgba(0,0,0,0)");
    vgn.addColorStop(1, "rgba(0,0,0,.45)");
    vg.fillStyle = vgn;
    vg.fillRect(wx, wy, ww, wh);
    // the bright-line frame for the 50 mm lens
    const fw = ww * 0.74, fh = Math.min(wh * 0.76, fw / 1.5), fx = W / 2 - fw / 2, fy = H / 2 - fh / 2, cl = Math.min(fw, fh) * 0.12;
    vg.strokeStyle = "rgba(255, 246, 222, .9)";
    vg.lineWidth = Math.max(1, 1.4 * dpr);
    vg.shadowColor = "rgba(255, 236, 190, .55)";
    vg.shadowBlur = 4 * dpr;
    vg.beginPath();
    [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].forEach(([x, y, sx, sy]) => {
      vg.moveTo(x + sx * cl, y); vg.lineTo(x, y); vg.lineTo(x, y + sy * cl);
    });
    vg.stroke();
    vg.shadowBlur = 0;
    // the rangefinder patch: the scene, and over it the second image, as far off as the focus is
    const pw = Math.max(ww * 0.2, 70 * dpr), ph = Math.max(wh * 0.15, pw * 0.6), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    if (place) {
      vg.save();
      vg.beginPath();
      vg.roundRect ? vg.roundRect(px, py, pw, ph, 3 * dpr) : vg.rect(px, py, pw, ph);
      vg.clip();
      vg.drawImage(img, place.ox, place.oy, place.dw, place.dh);
      vg.globalAlpha = 0.55;
      vg.drawImage(img, place.ox + shift(ww), place.oy, place.dw, place.dh);
      vg.globalAlpha = 1;
      vg.globalCompositeOperation = "overlay";
      vg.fillStyle = "rgba(255, 210, 120, .22)";
      vg.fillRect(px, py, pw, ph);
      vg.globalCompositeOperation = "source-over";
      vg.fillStyle = "rgba(255, 236, 200, .08)";
      vg.fillRect(px, py, pw, ph);
      vg.restore();
    }
    vg.strokeStyle = "rgba(255, 232, 180, .38)";
    vg.lineWidth = Math.max(1, dpr);
    vg.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    vg.restore();
  }
  // How far the second image lies off the first, in pixels of the finder's window: in
  // proportion to the focus error in dioptres, nearly half the window over the ring's travel.
  function shift(ww) { return (invNow() - target) * ((ww * 0.42) / INV_MAX); }

  /* ---------- The camera, in 3D ---------- */
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    renderer = null;
  }
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, 0.5, 200);
  let ring = null, release = null, ringPivot = new THREE.Vector3();
  if (renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene.background = new THREE.Color(0x070707);
    scene.environment = studio(renderer);
    const built = buildCamera(scene);
    ring = built.ring;
    release = built.release;
    ringPivot = built.pivot;
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(-14, 22, 18);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
    rim.position.set(16, 10, -14);
    scene.add(rim);
    // a low light raking across the lens from the front left, so the ring's ribs and its scale show
    const rake = new THREE.DirectionalLight(0xffffff, 1.4);
    rake.position.set(-22, 7, 16);
    scene.add(rake);
  }

  /* ---------- Views of the camera ---------- */
  // At the start a slow turn round it; in play, a three-quarter view from above the lens,
  // the focus ring and its scale towards the player.
  const VIEW_PLAY = { pos: new THREE.Vector3(-11.5, 13.5, 21), look: new THREE.Vector3(-1.4, 3.7, 4.4) };
  let view = { pos: VIEW_PLAY.pos.clone(), look: VIEW_PLAY.look.clone() }, viewFrom = null, viewAt = 0;
  function orbit(t) {
    const a = -0.55 + Math.sin(t / 5200) * 0.42, R = 31;
    return { pos: new THREE.Vector3(Math.sin(a) * R, 14 + Math.sin(t / 3700) * 1.5, Math.cos(a) * R), look: new THREE.Vector3(0, 3.6, 1.2) };
  }
  function goPlayView(now) {
    viewFrom = { pos: view.pos.clone(), look: view.look.clone() };
    viewAt = now;
  }

  /* ---------- The game ---------- */
  const best = (() => { try { return +localStorage.getItem("focus-challenge-best") || 0; } catch (e) { return 0; } })();
  let state = "intro", round = 0, target = 0.5, ang = angOf(0.2), t0 = 0, results = [], need = true, raf = 0, ringV = 0;
  function invNow() { return invOf(ang); }
  function setAng(a) {
    const na = clamp(a, 0, A_MAX);
    if (na !== ang) { ang = na; need = true; }
  }
  // a subject somewhere between 0.8 m and 8 m, evenly spread on the ring (in 1 / distance),
  // the ring left well away from it
  function newRound() {
    const inv = lerp(1 / 8, 1 / 0.8, Math.random());
    target = inv;
    let start = Math.random() * INV_MAX, tries = 0;
    while (Math.abs(start - inv) < 0.35 && tries++ < 20) start = Math.random() * INV_MAX;
    setAng(angOf(start));
  }
  function showCard(html) {
    card.innerHTML = html;
    card.hidden = false;
    root.classList.add("has-card");
    const b = card.querySelector("button");
    if (b) b.focus({ preventScroll: true });
  }
  function hideCard() {
    card.hidden = true;
    root.classList.remove("has-card");
  }
  function intro() {
    state = "intro";
    roundEl.textContent = "";
    hintEl.textContent = "";
    showCard(
      '<h2 class="fg__h">Focus challenge</h2>' +
      "<p>The camera's finder shows the photograph, and a bright patch in its middle shows it twice. Turn the lens's focus ring until the two images in the patch become one, then release the shutter.</p>" +
      '<p class="fg__small">' + ROUNDS + " rounds, " + ROUND_MS / 1000 + " seconds each, a subject at a different distance every time. Drag across the lens, scroll, or use ← → (Shift for big turns); Space releases." +
      (best ? " Your best: " + best.toFixed(1) + "%." : "") + "</p>" +
      '<button class="fg__btn fg__btn--solid" type="button" data-fg="start">Start</button>'
    );
  }
  function begin(now) {
    results = [];
    round = 0;
    goPlayView(now);
    next(now);
  }
  function next(now) {
    hideCard();
    loadPic(round);
    loadPic(round + 1);
    newRound();
    state = "play";
    t0 = now;
    roundEl.textContent = "Round " + (round + 1) + " of " + ROUNDS;
    hintEl.textContent = "Turn the focus ring until the two images in the patch become one";
    goBtn.disabled = false;
    root.focus({ preventScroll: true });
    need = true;
  }
  function shoot(now, late) {
    if (state !== "play") return;
    state = "shot";
    goBtn.disabled = true;
    const err = Math.abs(invNow() - target), c = blurMm(err), acc = accuracy(err);
    const s = invNow() > 1e-6 ? 1 / invNow() : Infinity, d = 1 / target;
    const used = clamp(now - t0, 0, ROUND_MS) / 1000;
    const r = { err, c, acc, s, d, used, late, k: round };
    results.push(r);
    pressAt = now;
    const p = pics[round].p;
    const last = round + 1 >= ROUNDS;
    showCard(
      '<div class="fg__shot"><img src="' + p.thumb + '" alt="" style="filter: blur(' + blurPx(c).toFixed(2) + 'px)"></div>' +
      '<p class="fg__acc"><b>' + acc.toFixed(1) + '%</b> <span class="fg__v fg__v--' + (c <= COC ? "ok" : "off") + '">' + verdict(c) + "</span></p>" +
      '<dl class="fg__nums"><div><dt>Subject</dt><dd>' + metres(d) + "</dd></div><div><dt>Focused at</dt><dd>" + metres(s) + "</dd></div>" +
      "<div><dt>Off by</dt><dd>" + (isFinite(s) ? gap(Math.abs(s - d) * 100) : "all the way") + "</dd></div><div><dt>Time</dt><dd>" + (late ? "Out of time" : used.toFixed(1) + " s") + "</dd></div></dl>" +
      '<button class="fg__btn fg__btn--solid" type="button" data-fg="' + (last ? "done" : "next") + '">' + (last ? "See the score" : "Next round") + "</button>"
    );
    roundEl.textContent = "Round " + (round + 1) + " of " + ROUNDS + ": " + acc.toFixed(1) + "%, " + verdict(c).toLowerCase();
    hintEl.textContent = "";
  }
  // how the blur circle would look on the little print: the film is 36 mm wide
  function blurPx(c) { return Math.min(14, (c / 36) * 260 * 0.6); }
  function done() {
    state = "done";
    const avg = results.reduce((s, r) => s + r.acc, 0) / results.length;
    const sharp = results.filter((r) => r.c <= COC).length;
    const t = results.reduce((s, r) => s + r.used, 0) / results.length;
    let isBest = false;
    if (avg > best) { isBest = true; try { localStorage.setItem("focus-challenge-best", avg.toFixed(2)); } catch (e) {} }
    roundEl.textContent = "Score: " + avg.toFixed(1) + "%";
    showCard(
      '<h2 class="fg__h">' + avg.toFixed(1) + "%" + (isBest ? ' <span class="fg__best">best yet</span>' : "") + "</h2>" +
      "<p>" + sharp + " of " + ROUNDS + " frames sharp · " + t.toFixed(1) + " s a frame on average</p>" +
      '<ol class="fg__list">' + results.map((r) => "<li><span>" + r.acc.toFixed(1) + "%</span><span>" + verdict(r.c) + "</span><span>" + metres(r.d) + "</span></li>").join("") + "</ol>" +
      '<p class="fg__small">The percentage is how close the two images came together; sharp means the blur on the film was within 0.03 mm for this 50 mm f/2 lens.</p>' +
      '<div class="fg__row"><button class="fg__btn fg__btn--solid" type="button" data-fg="again">Play again</button><button class="fg__btn" type="button" data-fg="close">Back to the photograph</button></div>'
    );
  }

  /* ---------- Hands on ---------- */
  card.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fg]");
    if (!b) return;
    const a = b.getAttribute("data-fg"), now = performance.now();
    if (a === "start" || a === "again") begin(now);
    else if (a === "next") { round++; next(now); }
    else if (a === "done") done();
    else if (a === "close") close();
  });
  goBtn.addEventListener("click", () => shoot(performance.now(), false));
  $(".fg__x").addEventListener("click", () => close());
  // dragging across the lens turns the ring: its near edge follows the finger
  let drag = null;
  function ringDir() {
    // which way on screen the ring's top moves as it turns
    if (!renderer) return 1;
    const top = new THREE.Vector3(0, 2.62, 0), a = top.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.05);
    const p0 = top.add(ringPivot).project(cam), p1 = a.add(ringPivot).project(cam);
    return p1.x - p0.x >= 0 ? 1 : -1;
  }
  gl.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    drag = { id: e.pointerId, x: e.clientX, dir: ringDir() };
    try { gl.setPointerCapture(e.pointerId); } catch (x) {}
    howEl.classList.add("is-gone");
  });
  gl.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    drag.x = e.clientX;
    // a full turn of the ring over about two thirds of the panel's width
    setAng(ang + drag.dir * dx * (A_MAX / Math.max(240, gl.clientWidth * 0.66)));
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  gl.addEventListener("pointerup", endDrag);
  gl.addEventListener("pointercancel", endDrag);
  root.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (state !== "play") return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    setAng(ang + d * (e.deltaMode === 1 ? 16 : 1) * 0.0016);
    howEl.classList.add("is-gone");
  }, { passive: false });
  // the keys: arrows turn (Shift for big turns), Space or Enter releases, Escape leaves
  function onKey(e) {
    if (closed || !host.open) return;
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state === "play") setAng(ang + (k === "ArrowRight" || k === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 0.06 : 0.0035));
      return;
    }
    if ((k === " " || k === "Enter") && state === "play" && !(e.target && e.target.closest && e.target.closest("button"))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      shoot(performance.now(), false);
    }
  }
  window.addEventListener("keydown", onKey, true);
  // Escape on the close-up would close it: here it only leaves the game
  function onCancel(e) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  host.addEventListener("cancel", onCancel, true);

  /* ---------- Sizing and drawing ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fr = vf.parentNode.getBoundingClientRect();
    vw = Math.max(1, Math.round(fr.width));
    vh = Math.max(1, Math.round(fr.height));
    vf.width = Math.round(vw * dpr);
    vf.height = Math.round(vh * dpr);
    if (renderer) {
      const cr = gl.parentNode.getBoundingClientRect();
      renderer.setPixelRatio(dpr);
      renderer.setSize(Math.max(1, cr.width), Math.max(1, cr.height), false);
      cam.aspect = Math.max(0.2, cr.width / Math.max(1, cr.height));
      cam.fov = cam.aspect < 1 ? 36 : 28;
      cam.updateProjectionMatrix();
    }
    need = true;
  }
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(root); else window.addEventListener("resize", resize);

  let pressAt = -1e9, lastRing = -1, held = false, lastNow = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    // the clock (a test can hold it still)
    if (held && state === "play") t0 += now - lastNow;
    lastNow = now;
    if (state === "play") {
      const left = Math.max(0, ROUND_MS - (now - t0));
      secsEl.textContent = (left / 1000).toFixed(1);
      barEl.style.transform = "scaleX(" + (left / ROUND_MS).toFixed(4) + ")";
      root.classList.toggle("is-late", left < 2500);
      if (left <= 0) shoot(now, true);
    } else if (state === "intro") {
      secsEl.textContent = (ROUND_MS / 1000).toFixed(1);
      barEl.style.transform = "scaleX(1)";
    }
    // the camera: turning round it at the start, settling into the play view
    let moving = false;
    if (renderer) {
      if (state === "intro" && !still) { view = orbit(now); moving = true; }
      else if (viewFrom) {
        const k = still ? 1 : clamp((now - viewAt) / 1400, 0, 1), e = ease(k);
        view = { pos: viewFrom.pos.clone().lerp(VIEW_PLAY.pos, e), look: viewFrom.look.clone().lerp(VIEW_PLAY.look, e) };
        if (k >= 1) viewFrom = null;
        moving = true;
      }
      cam.position.copy(view.pos);
      cam.lookAt(view.look);
      if (ring && ring.rotation.z !== ang) { ring.rotation.z = ang; moving = true; }
      // the shutter button goes down and comes back up
      const pk = clamp((now - pressAt) / 260, 0, 1), down = pk < 1 ? Math.sin(pk * Math.PI) : 0;
      if (release) { const y = release.userData.y0 - down * 0.18; if (release.position.y !== y) { release.position.y = y; moving = true; } }
    }
    if (need || lastRing !== ang) { drawFinder(); lastRing = ang; }
    if (renderer && (need || moving)) renderer.render(scene, cam);
    need = false;
  }

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey, true);
    host.removeEventListener("cancel", onCancel, true);
    if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
    if (renderer) {
      scene.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) [].concat(m.material).forEach((mt) => { Object.values(mt).forEach((v) => { if (v && v.isTexture) v.dispose(); }); mt.dispose(); });
      });
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) {}
    }
    root.classList.add("is-leaving");
    setTimeout(() => root.remove(), still ? 0 : 180);
    if (o.onClose) o.onClose();
  }

  resize();
  loadPic(0);
  intro();
  raf = requestAnimationFrame(frame);
  return {
    close,
    // for tests: set the ring to a distance (in dioptres) and read where things stand
    test: {
      setInv: (inv) => setAng(angOf(clamp(inv, 0, INV_MAX))),
      target: () => target,
      offset: () => shift(vf.width - 2 * Math.round(Math.min(vf.width, vf.height) * 0.035)),
      state: () => state,
      results: () => results.slice(),
      start: () => begin(performance.now()),
      shoot: () => shoot(performance.now(), false),
      next: () => { round++; next(performance.now()); },
      done: () => done(),
      hold: (on) => { held = !!on; },
      ang: () => ang
    }
  };
}

/* ---------- The studio: soft boxes for the metal to reflect ---------- */
function studio(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x040404);
  const panel = (w, h, pos, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(14, 8, new THREE.Vector3(-4, 14, 6), new THREE.Color(3.2, 3.1, 2.9));   // the big box overhead
  panel(3, 16, new THREE.Vector3(-16, 4, -2), new THREE.Color(1.6, 1.6, 1.7));  // a strip on the left
  panel(3, 16, new THREE.Vector3(16, 5, 4), new THREE.Color(1.1, 1.05, 1));     // and a dimmer one right
  panel(40, 40, new THREE.Vector3(0, -12, 0), new THREE.Color(0.05, 0.05, 0.05)); // the table, far below
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  env.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
  return tex;
}

/* ---------- The camera: a rangefinder body and a 50 mm f/2 lens, in centimetres ---------- */
function label(text, opt) {
  const px = opt.px || 64, c = document.createElement("canvas"), g = c.getContext("2d");
  const font = (opt.weight || 600) + " " + px + "px " + (opt.font || '"Helvetica Neue", Arial, sans-serif');
  g.font = font;
  const w = Math.ceil(g.measureText(text).width + px * 0.3), h = Math.ceil(px * 1.25);
  c.width = w; c.height = h;
  g.font = font;
  g.fillStyle = opt.color || "#f4f1ea";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + px * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const hgt = opt.h || 0.3;
  const m = new THREE.Mesh(new THREE.PlaneGeometry((hgt * w) / h, hgt), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.renderOrder = 2;
  return m;
}
// put a flat thing on a cylinder round the z axis at angle phi, facing out, its top towards the front
function onBarrel(m, r, phi, z) {
  const n = new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0), u = new THREE.Vector3(0, 0, 1), rt = new THREE.Vector3().crossVectors(u, n);
  m.matrixAutoUpdate = false;
  m.matrix.makeBasis(rt, u, n).setPosition(n.clone().multiplyScalar(r).setZ(z));
  return m;
}
function ribbed(rOut, rIn, depth, ribs, rib) {
  // a knurled ring: ribs round the outside, extruded along z
  const s = new THREE.Shape(), steps = ribs * 4;
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * Math.PI * 2, q = k % 4, r = q === 1 || q === 2 ? rOut : rOut - rib;
    if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
}
function tube(r, z0, z1, segs) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, segs || 96, 1, false);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}
function leatherTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d"), d = g.createImageData(256, 256);
  for (let k = 0; k < 256 * 256; k++) {
    const v = 128 + (Math.random() - 0.5) * 120;
    d.data[k * 4] = d.data[k * 4 + 1] = d.data[k * 4 + 2] = v;
    d.data[k * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  g.filter = "blur(1px)";
  g.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3);
  return t;
}
function buildCamera(scene) {
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdedcd6, metalness: 1, roughness: 0.2 });
  const satin = new THREE.MeshStandardMaterial({ color: 0xc8c6c0, metalness: 1, roughness: 0.34 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, metalness: 0.55, roughness: 0.36 });
  // the lens's anodised black, a touch lighter and glossier so its ribs catch the light
  const anod = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, metalness: 0.7, roughness: 0.28 });
  const blackMatte = new THREE.MeshStandardMaterial({ color: 0x090909, metalness: 0.2, roughness: 0.7 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0, roughness: 0.82, bumpMap: leatherTexture(), bumpScale: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 520], envMapIntensity: 2.2 });
  const winGlass = new THREE.MeshPhysicalMaterial({ color: 0x0d1013, metalness: 0.1, roughness: 0.06, clearcoat: 1, envMapIntensity: 1.6 });
  const frosted = new THREE.MeshStandardMaterial({ color: 0xe9e6de, metalness: 0, roughness: 0.55, emissive: 0x2a2822 });
  const cam = new THREE.Group();
  scene.add(cam);

  // the body: a long box with rounded ends, seen from above; chrome below and above, leather between
  const W = 13.8, D = 3.3, R = 1.5;
  const outline = (inset) => {
    const s = new THREE.Shape(), x = W / 2 - inset, z = D / 2 - inset, r = R - inset;
    s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
    s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
    return s;
  };
  const slab = (inset, y0, y1, mat, bevel) => {
    const g = new THREE.ExtrudeGeometry(outline(inset + (bevel || 0)), { depth: y1 - y0 - 2 * (bevel || 0), bevelEnabled: !!bevel, bevelSize: bevel || 0, bevelThickness: bevel || 0, bevelSegments: 4, curveSegments: 16 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0 + (bevel || 0), 0);
    const m = new THREE.Mesh(g, mat);
    cam.add(m);
    return m;
  };
  slab(0, 0, 0.62, satin, 0.12);
  slab(0.05, 0.6, 5.35, leather);
  slab(0, 5.3, 7.7, satin, 0.16);
  // the windows on the front: the finder, the frame-line light, the rangefinder
  const win = (w, h, x, y, mat) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, h + 0.22, 0.08), black);
    f.position.set(x, y, D / 2 + 0.02);
    const gpl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    gpl.position.set(x, y, D / 2 + 0.065);
    cam.add(f, gpl);
  };
  win(2.05, 1.4, 4.35, 6.45, winGlass);
  win(1.45, 0.95, 1.85, 6.5, frosted);
  win(1.15, 0.95, -2.75, 6.5, winGlass);
  // the eyepiece at the back
  const eye = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.25, 0.25), black);
  eye.position.set(4.35, 6.45, -D / 2 - 0.08);
  cam.add(eye);
  // the top: the speed dial, the release, the advance lever, the rewind knob, the shoe
  const top = 7.7;
  const dial = new THREE.Mesh(ribbed(0.95, 0.01, 0.48, 40, 0.05), satin);
  dial.rotation.x = -Math.PI / 2;
  dial.position.set(-3.3, top, 0.1);
  cam.add(dial);
  const dialTop = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), black);
  dialTop.rotation.x = -Math.PI / 2;
  dialTop.position.set(-3.3, top + 0.485, 0.1);
  cam.add(dialTop);
  ["125", "250", "500", "60"].forEach((t, k) => {
    const l = label(t, { h: 0.2, px: 56 });
    l.rotation.x = -Math.PI / 2;
    l.rotation.z = Math.PI + (k - 1.5) * 0.65;
    const a = Math.PI / 2 + (k - 1.5) * 0.65;
    l.position.set(-3.3 + Math.cos(a) * 0.58, top + 0.495, 0.1 - Math.sin(a) * 0.58);
    cam.add(l);
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.26, 40), satin);
  collar.position.set(-4.85, top + 0.13, 0.5);
  const release = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.34, 32), chrome);
  release.position.set(-4.85, top + 0.4, 0.5);
  release.userData.y0 = release.position.y;
  cam.add(collar, release);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.42), chrome);
  lever.position.set(-5.7, top + 0.32, -0.55);
  lever.rotation.y = 0.55;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.36, 20), blackMatte);
  tip.rotation.z = Math.PI / 2;
  tip.position.set(-6.45, top + 0.32, -1.05);
  cam.add(lever, tip);
  const rewind = new THREE.Mesh(ribbed(0.72, 0.01, 0.55, 30, 0.05), satin);
  rewind.rotation.x = -Math.PI / 2;
  rewind.position.set(5.3, top, 0);
  cam.add(rewind);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 2.0), satin);
  shoe.position.set(0.6, top + 0.06, 0);
  const rail = new THREE.BoxGeometry(0.16, 0.18, 2.0);
  [-0.85, 0.85].forEach((dx) => { const m = new THREE.Mesh(rail, satin); m.position.set(0.6 + dx, top + 0.15, 0); cam.add(m); });
  cam.add(shoe);
  // strap lugs on the ends
  [-1, 1].forEach((sx) => {
    const lug = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 24), chrome);
    lug.position.set(sx * (W / 2 + 0.12), 6.3, 0);
    lug.rotation.y = Math.PI / 2;
    cam.add(lug);
  });

  // the lens, on the front, its axis along z
  const lens = new THREE.Group();
  lens.position.set(-0.4, 3.35, D / 2);
  cam.add(lens);
  lens.add(new THREE.Mesh(tube(2.62, 0, 0.26), satin));                 // the mount
  lens.add(new THREE.Mesh(tube(2.44, 0.26, 1.02), anod));              // the fixed barrel, with the depth-of-field scale
  // the index line and the depth-of-field scale either side of it: for f/4, f/8 and f/16, where
  // the near and far limits fall on the distance scale
  const idx = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.42), new THREE.MeshBasicMaterial({ color: 0xf4f1ea, toneMapped: false }));
  lens.add(onBarrel(idx, 2.445, Math.PI / 2, 0.78));
  [4, 8, 16].forEach((n) => {
    const da = angOf((n * COC) / (F_MM * F_MM) * 1000);
    [-1, 1].forEach((sd) => {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.22), new THREE.MeshBasicMaterial({ color: 0xcfcbc2, toneMapped: false }));
      lens.add(onBarrel(tick, 2.445, Math.PI / 2 + sd * da, 0.88));
      lens.add(onBarrel(label(String(n), { h: 0.2, px: 48, color: "#cfcbc2" }), 2.446, Math.PI / 2 + sd * da, 0.6));
    });
  });
  // the focus ring: knurled grip, the distance scale beside it, and the tab underneath; it turns as one
  const ring = new THREE.Group();
  lens.add(ring);
  const grip = new THREE.Mesh(ribbed(2.62, 2.3, 0.9, 72, 0.07), anod);
  grip.position.z = 1.04;
  ring.add(grip);
  ring.add(new THREE.Mesh(tube(2.5, 1.94, 2.52), anod));
  const marks = [[Infinity, "∞"], [10, "10"], [5, "5"], [3, "3"], [2, "2"], [1.5, "1.5"], [1.2, "1.2"], [1, "1"], [0.9, ".9"], [0.8, ".8"], [0.7, ".7"]];
  marks.forEach(([d, t]) => {
    const phi = Math.PI / 2 - angOf(1 / d);
    ring.add(onBarrel(label(t, { h: t === "∞" ? 0.36 : 0.3, px: 72 }), 2.505, phi, 2.3));
  });
  [[Infinity, "∞"], [30, "30"], [15, "15"], [10, "10"], [7, "7"], [5, "5"], [4, "4"], [3, "3"], [2.5, "2.5"]].forEach(([ft, t]) => {
    const phi = Math.PI / 2 - angOf(1 / (ft * 0.3048));
    ring.add(onBarrel(label(t, { h: 0.18, px: 56, color: "#e3a54a" }), 2.505, phi, 2.08));
  });
  const tab = new THREE.Group();
  const tabArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.34), black);
  tabArm.position.set(0, -2.85, 1.5);
  const tabEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.36, 24), black);
  tabEnd.rotation.x = Math.PI / 2;
  tabEnd.position.set(0, -3.2, 1.5);
  tab.add(tabArm, tabEnd);
  ring.add(tab);
  // the aperture ring, set at f/2, and the front of the lens
  const ap = new THREE.Mesh(ribbed(2.48, 2.2, 0.5, 24, 0.06), anod);
  ap.position.z = 2.54;
  lens.add(ap);
  [["2", 0], ["2.8", 0.3], ["4", 0.58], ["5.6", 0.86], ["8", 1.12]].forEach(([t, a]) => {
    lens.add(onBarrel(label(t, { h: 0.2, px: 56 }), 2.49, Math.PI / 2 - a, 2.79));
  });
  lens.add(new THREE.Mesh(tube(2.32, 3.04, 3.62), anod));
  const lip = new THREE.Mesh(new THREE.RingGeometry(1.86, 2.32, 96), black);
  lip.position.z = 3.62;
  lens.add(lip);
  const name = label("1:2  50 mm", { h: 0.18, px: 48, color: "#d9d5cc" });
  name.position.set(0, 2.07, 3.625);
  lens.add(name);
  const inner = new THREE.Mesh(tube(1.86, 2.6, 3.6), new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.9, side: THREE.BackSide }));
  lens.add(inner);
  // the front element: a shallow dome of coated glass
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 64, 16, 0, Math.PI * 2, 0, Math.asin(1.86 / 4.6)), glass);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 3.5 - 4.6 * Math.cos(Math.asin(1.86 / 4.6)) + 0.04;
  lens.add(dome);

  // the table, and a soft shadow on it
  const table = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9, metalness: 0 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.01;
  scene.add(table);
  const sc = document.createElement("canvas");
  sc.width = sc.height = 128;
  const sg = sc.getContext("2d"), grd = sg.createRadialGradient(64, 64, 6, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,.85)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grd;
  sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(19, 9.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(-0.2, 0.005, 1.2);
  scene.add(shadow);

  return { ring, release, pivot: lens.position.clone() };
}
