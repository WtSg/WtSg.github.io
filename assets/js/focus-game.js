/*
 * The focus challenge, opened from the close-up on the wall: a small game with a rangefinder.
 * Through the camera's finder a photograph is the scene, and in the bright patch in the
 * middle a second image of it lies beside the first. Hold, drag that second image onto the
 * first, and let go: letting go releases the shutter (a tap shoots as it stands, for anyone
 * who would rather time it). A roll is twelve frames, and the subject moves more from frame
 * to frame: still, then swaying, then walking off, with the hand shaking a little at the end.
 * As on a Leica, nothing says when the two images are one (no lamp, no beep): the eye
 * judges, and only after the shutter does the game say how close they were. Each frame is
 * ranked only by how closely the two images met; the game makes up no distances, since it
 * cannot know how far away anything in a photograph was. Sharp frames in a row build a
 * streak, and the roll ends on a contact sheet. Today's roll is the same twelve frames,
 * moving the same way, for everyone on the same day. A guide teaches rangefinder focusing
 * step by step in the same finder. The camera on the title is a design of its own: no
 * maker's name or mark.
 */
import * as THREE from "three";

const FRAMES = 12;
// the scales engraved on the title camera's lens (it focuses from 0.7 m to infinity, 50 mm f/2)
const NEAR = 0.7, INV_MAX = 1 / NEAR, A_MAX = 2.6, F_MM = 50, COC = 0.03;
const angOf = (inv) => (inv / INV_MAX) * A_MAX;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// How far apart the two images were when the shutter went, in widths of the patch.
const RANKS = [
  { max: 0.008, name: "Critically sharp", pts: 100, mark: "●" },
  { max: 0.02, name: "Sharp", pts: 70, mark: "◐" },
  { max: 0.06, name: "Soft", pts: 30, mark: "○" },
  { max: Infinity, name: "Missed", pts: 0, mark: "·" }
];
const rankOf = (e) => RANKS.find((r) => e <= r.max);
const sharpish = (r) => r.pts >= 70;
// one patch width of drag moves the second image this far, so a finger's tremble matters less
const GAIN = 0.65;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  return h >>> 0;
}
const pad2 = (n) => (n < 10 ? "0" : "") + n;
function todayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

// How the subject moves in frame k: still at first, then swaying, then walking off, the hand
// shaking a little towards the end; and how long the frame lasts.
function motion(k, r) {
  const t = k / (FRAMES - 1);
  const sign = r() < 0.5 ? -1 : 1;
  return {
    u0: sign * (0.2 + 0.2 * r()),
    amp: k === 0 ? 0 : 0.01 + 0.07 * t * (0.6 + 0.4 * r()),
    freq: 0.18 + 0.5 * t * (0.5 + r()),
    phase: r() * Math.PI * 2,
    walk: k < 4 ? 0 : (r() < 0.5 ? -1 : 1) * 0.04 * t * (0.5 + r()),
    shake: k < 6 ? 0 : 0.5 + 2 * t,
    ms: Math.round(lerp(5600, 3600, t))
  };
}

/* ---------- Sound: made here, nothing to load; off unless asked for ---------- */
function makeSound() {
  let ctx = null, noise = null;
  const s = { on: store.get("focus-challenge-sound") === "on" };
  function ready() {
    if (!s.on) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function burst(at, dur, f, q, gain, type) {
    const c = ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise;
    fl.type = type || "bandpass";
    fl.frequency.value = f;
    fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(fl).connect(g).connect(c.destination);
    src.start(at, Math.random() * 0.1, dur + 0.02);
  }
  function tone(at, f, dur, gain) {
    const c = ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
  // the cloth shutter: a soft first curtain and a crisper second one
  s.shutter = () => { if (!ready()) return; const t = ctx.currentTime; burst(t, 0.035, 1800, 0.9, 0.5); tone(t, 140, 0.03, 0.25); burst(t + 0.045, 0.03, 3200, 1.2, 0.35); };
  // the film advancing: a run of small ratchet clicks
  s.advance = () => { if (!ready()) return; const t = ctx.currentTime + 0.05; for (let k = 0; k < 6; k++) burst(t + k * 0.03, 0.008, 4200, 2, 0.12 - k * 0.012, "highpass"); };
  // a soft click, to say the sound is on
  s.tick = () => { if (!ready()) return; burst(ctx.currentTime, 0.006, 5200, 3, 0.09, "highpass"); };
  s.streak = (n) => { if (!ready()) return; const t = ctx.currentTime + 0.12; tone(t, 880, 0.09, 0.06); tone(t + 0.07, 880 * Math.pow(2, Math.min(n, 5) / 12 + 0.5), 0.12, 0.05); };
  s.toggle = () => { s.on = !s.on; store.set("focus-challenge-sound", s.on ? "on" : "off"); if (s.on) ready(); return s.on; };
  s.close = () => { if (ctx) try { ctx.close(); } catch (e) {} };
  return s;
}
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

const ICON_X = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_SND = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path class="fg__wave" d="M15.5 9.2a4 4 0 0 1 0 5.6M18 7a7.2 7.2 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="fg__mute" d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

export function start(o) {
  const host = o.host, photos = o.photos || [], still = !!o.still;
  const touch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  let closed = false;
  const snd = makeSound();

  /* ---------- The page ---------- */
  const root = document.createElement("div");
  root.className = "fg is-title";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Focus challenge");
  root.tabIndex = -1;
  let strip = "";
  for (let k = 0; k < FRAMES; k++) strip += '<li class="fg__frm"><span class="fg__no">' + (k + 1) + '</span><img alt="" draggable="false"></li>';
  root.innerHTML =
    '<header class="fg__top"><p class="fg__title">Focus challenge</p><p class="fg__mode"></p>' +
    '<button class="fg__icon fg__snd" type="button" aria-pressed="false" aria-label="Sound">' + ICON_SND + "</button>" +
    '<button class="fg__icon fg__x" type="button" aria-label="Back to the photograph">' + ICON_X + "</button></header>" +
    '<div class="fg__main"><canvas class="fg__gl" aria-hidden="true"></canvas>' +
    '<div class="fg__finder"><canvas class="fg__vf" aria-hidden="true"></canvas><img class="fg__cap" alt="" draggable="false"><span class="fg__curtain" aria-hidden="true"></span><p class="fg__pop" aria-hidden="true"></p></div>' +
    '<div class="fg__td"><div class="fg__td-bar"><label for="fg-td-at">Lens focused at</label>' +
    '<input id="fg-td-at" type="range" min="0" max="4" step="1" value="0" aria-valuetext="infinity"><output for="fg-td-at">∞</output>' +
    '<p class="fg__td-note">Not to scale: angles and movement drawn five times their size. The classic layout of a coincident-image rangefinder, drawn as an illustration rather than any one camera\'s construction.</p></div>' +
    '<figure class="fg__td-fig" aria-live="polite"></figure></div></div>' +
    '<div class="fg__readout" aria-hidden="true">' +
    '<span class="fg__cell fg__cell--frame"><small>Frame</small><b class="fg__count">01</b><small>/' + FRAMES + "</small></span>" +
    '<span class="fg__cell fg__cell--streak"><small>Streak</small><b class="fg__streak">0</b></span>' +
    '<span class="fg__cell"><small>Score</small><b class="fg__score">0</b></span></div>' +
    '<div class="fg__time" aria-hidden="true"><i></i></div>' +
    '<ol class="fg__strip" aria-hidden="true">' + strip + "</ol>" +
    '<p class="fg__hint"></p><p class="fg__sr" aria-live="polite"></p>' +
    '<div class="fg__view" role="group" aria-label="A frame from the roll" hidden><figure class="fg__view-fig"><img class="fg__view-img" alt="" draggable="false"></figure>' +
    '<p class="fg__view-cap" aria-live="polite"></p>' +
    '<div class="fg__view-keys"><button class="fg__icon" type="button" data-v="prev" aria-label="Previous frame"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<button class="fg__btn" type="button" data-v="back">Back to the roll</button>' +
    '<button class="fg__icon" type="button" data-v="next" aria-label="Next frame"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>' +
    '<section class="fg__card" hidden></section>';
  host.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const vf = $(".fg__vf"), gl = $(".fg__gl"), finder = $(".fg__finder"), curtain = $(".fg__curtain"), pop = $(".fg__pop"), cap = $(".fg__cap");
  const modeEl = $(".fg__mode"), countEl = $(".fg__count"), streakEl = $(".fg__streak"), scoreEl = $(".fg__score"), timeEl = $(".fg__time i");
  const hintEl = $(".fg__hint"), srEl = $(".fg__sr"), card = $(".fg__card"), sndBtn = $(".fg__snd");
  const viewEl = $(".fg__view"), viewImg = $(".fg__view-img"), viewCap = $(".fg__view-cap");
  const slots = Array.prototype.slice.call(root.querySelectorAll(".fg__frm"));
  // nothing in here reaches the close-up underneath: its clicks, swipes, pinches and wheel
  ["click", "dblclick", "pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "touchstart", "touchmove", "touchend", "gesturestart", "gesturechange", "gestureend", "contextmenu"].forEach((t) =>
    root.addEventListener(t, (e) => e.stopPropagation()));
  function showSound() { sndBtn.setAttribute("aria-pressed", snd.on ? "true" : "false"); sndBtn.setAttribute("aria-label", snd.on ? "Sound on" : "Sound off"); }
  showSound();
  sndBtn.addEventListener("click", () => { snd.toggle(); showSound(); if (snd.on) snd.tick(); });

  /* ---------- The roll: which photographs, and how each frame moves ---------- */
  let mode = "roll", dayKey = todayKey(), roll = [];
  function makeRoll(m) {
    mode = m;
    if (m === "guide") { roll = [{ p: photos[o.index | 0], img: null, full: false, at: null, m: guideMotion("still") }]; return; }
    const r = m === "day" ? rng(hashStr("focus-challenge " + dayKey)) : rng((Math.random() * 4294967296) >>> 0);
    const all = photos.map((_, i) => i);
    for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; }
    let pick = all;
    if (m === "roll") pick = [o.index | 0].concat(all.filter((i) => i !== (o.index | 0)));
    const ids = [];
    for (let k = 0; k < FRAMES; k++) ids.push(pick[k % Math.max(1, pick.length)]);
    roll = ids.map((i, k) => ({ p: photos[i], img: null, full: false, at: null, m: motion(k, r) }));
  }
  function loadPic(k) {
    const pc = roll[k];
    if (!pc || pc.loading) return;
    pc.loading = true;
    const thumb = new Image();
    thumb.decoding = "async";
    thumb.onload = () => { if (!pc.full) { pc.img = thumb; pc.at = pc.at || detail(thumb); need = true; } };
    thumb.src = pc.p.thumb;
    const big = new Image();
    big.decoding = "async";
    big.onload = () => { pc.img = big; pc.full = true; pc.at = pc.at || detail(big); need = true; };
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
      const bw = Math.max(2, Math.round(w * 0.16)), bh = Math.max(2, Math.round(h * 0.12));
      let best = -1, bx = w / 2, by = h / 2;
      for (let y = Math.round(h * 0.26); y <= Math.round(h * 0.74) - bh; y++) {
        for (let x = Math.round(w * 0.26); x <= Math.round(w * 0.74) - bw; x++) {
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
  // the guide's highlight breathes slowly (never a flash); still for anyone who asks for less motion
  const pulse = () => (still ? 1 : 0.5 + 0.5 * Math.sin(performance.now() / 420));
  const vg = vf.getContext("2d");
  let dpr = 1, patchCss = 120;
  function geom() {
    const W = vf.width, H = vf.height;
    const m = Math.round(Math.min(W, H) * 0.03), r = Math.min(W, H) * 0.05;
    const ww = W - 2 * m, wh = H - 2 * m;
    const pw = clamp(ww * 0.3, 120 * dpr, 360 * dpr), ph = Math.min(pw * 0.62, wh * 0.4);
    return { W, H, m, r, wx: m, wy: m, ww, wh, pw, ph, px: W / 2 - pw / 2, py: H / 2 - ph / 2 };
  }
  // hl: what the guide points at ("frame" or "patch"), never whether the images are one
  function drawFinder(u, shake, hl) {
    const G = geom(), { W, H, wx, wy, ww, wh, pw, ph, px, py } = G;
    vg.setTransform(1, 0, 0, 1, 0, 0);
    vg.fillStyle = "#000";
    vg.fillRect(0, 0, W, H);
    const pc = roll[frame], img = pc && pc.img;
    vg.save();
    vg.beginPath();
    vg.roundRect ? vg.roundRect(wx, wy, ww, wh, G.r) : vg.rect(wx, wy, ww, wh);
    vg.clip();
    vg.fillStyle = "#14130f";
    vg.fillRect(wx, wy, ww, wh);
    let place = null;
    if (img) {
      // the photograph as the scene, a little closer than the whole frame, its detail behind the patch
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.max(ww / iw, wh / ih) * 1.5, dw = iw * s, dh = ih * s, at = pc.at || { u: 0.5, v: 0.5 };
      const ox = clamp(wx + ww / 2 - at.u * dw, wx + ww - dw, wx) + shake.x * dpr, oy = clamp(wy + wh / 2 - at.v * dh, wy + wh - dh, wy) + shake.y * dpr;
      place = { ox, oy, dw, dh };
      vg.drawImage(img, ox, oy, dw, dh);
    }
    const vgn = vg.createRadialGradient(W / 2, H / 2, Math.min(ww, wh) * 0.32, W / 2, H / 2, Math.hypot(ww, wh) * 0.62);
    vgn.addColorStop(0, "rgba(0,0,0,0)");
    vgn.addColorStop(1, "rgba(0,0,0,.42)");
    vg.fillStyle = vgn;
    vg.fillRect(wx, wy, ww, wh);
    // bright-line corners
    const fw = ww * 0.8, fh = Math.min(wh * 0.8, fw / 1.5), fx = W / 2 - fw / 2, fy = H / 2 - fh / 2, cl = Math.min(fw, fh) * 0.11;
    const lit = hl === "frame" ? 0.5 + 0.5 * pulse() : 0;
    vg.strokeStyle = "rgba(255, 246, 222, .88)";
    vg.lineWidth = Math.max(1, (1.4 + 1.6 * lit) * dpr);
    vg.shadowColor = "rgba(255, 236, 190, " + (0.5 + 0.5 * lit) + ")";
    vg.shadowBlur = (4 + 10 * lit) * dpr;
    vg.beginPath();
    [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].forEach(([x, y, sx, sy]) => {
      vg.moveTo(x + sx * cl, y); vg.lineTo(x, y); vg.lineTo(x, y + sy * cl);
    });
    vg.stroke();
    vg.shadowBlur = 0;
    // the patch: the scene, and over it the second image, as far off as it is
    if (place) {
      vg.save();
      vg.beginPath();
      vg.roundRect ? vg.roundRect(px, py, pw, ph, 4 * dpr) : vg.rect(px, py, pw, ph);
      vg.clip();
      vg.drawImage(img, place.ox, place.oy, place.dw, place.dh);
      vg.globalAlpha = 0.55;
      vg.drawImage(img, place.ox + u * pw, place.oy, place.dw, place.dh);
      vg.globalAlpha = 1;
      vg.globalCompositeOperation = "overlay";
      vg.fillStyle = "rgba(255, 210, 120, .22)";
      vg.fillRect(px, py, pw, ph);
      vg.globalCompositeOperation = "source-over";
      vg.fillStyle = "rgba(255, 236, 200, .07)";
      vg.fillRect(px, py, pw, ph);
      vg.restore();
    }
    // its edge, the same whether the images are one or not (a rangefinder never says)
    const pl = hl === "patch" ? 0.5 + 0.5 * pulse() : 0;
    vg.strokeStyle = pl ? "rgba(255, 220, 160, " + (0.5 + 0.45 * pl) + ")" : "rgba(255, 232, 180, .36)";
    vg.lineWidth = (1 + 1.5 * pl) * Math.max(1, dpr);
    if (pl) { vg.shadowColor = "rgba(255, 200, 110, .8)"; vg.shadowBlur = 10 * pl * dpr; }
    vg.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    vg.shadowBlur = 0;
    vg.restore();
  }

  /* ---------- The camera on the title, in 3D ---------- */
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, powerPreference: "high-performance" }); } catch (e) { renderer = null; }
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const EYE = new THREE.Vector3(4.35, 6.45, -1.73);
  if (renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene.background = new THREE.Color(0x070707);
    scene.environment = studio(renderer);
    buildCamera(scene);
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(-14, 22, 18);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
    rim.position.set(16, 10, -14);
    const rake = new THREE.DirectionalLight(0xffffff, 1.4);
    rake.position.set(-22, 7, 16);
    scene.add(key, rim, rake);
  }
  let view = null, fly = null;
  function orbit(t) {
    const a = -0.6 + Math.sin(t / 5200) * 0.45, R = 30;
    return { pos: new THREE.Vector3(Math.sin(a) * R, 13 + Math.sin(t / 3700) * 1.5, Math.cos(a) * R), look: new THREE.Vector3(0, 3.8, 1.2) };
  }
  // lifting the camera to the eye: round behind it and into the eyepiece
  function flyAt(k) {
    const e = ease(k), a = fly.from.pos, c = new THREE.Vector3(14, 17, -16), b = EYE.clone().add(new THREE.Vector3(0, 0, -0.35));
    const p = a.clone().multiplyScalar((1 - e) * (1 - e)).add(c.clone().multiplyScalar(2 * e * (1 - e))).add(b.clone().multiplyScalar(e * e));
    return { pos: p, look: fly.from.look.clone().lerp(EYE.clone().add(new THREE.Vector3(0, 0, 8)), ease(clamp(k * 1.25, 0, 1))) };
  }

  /* ---------- The game ---------- */
  let state = "title", frame = 0, t0 = 0, adjust = 0, holding = null, results = [], total = 0, streak = 0, bestStreak = 0;
  let need = true, raf = 0, held = false, lastNow = 0, nextAt = 0, keyRep = 0, shotU = 0;
  function offsetAt(now) {
    const pc = roll[frame];
    if (!pc) return 0;
    const m = pc.m, t = Math.max(0, now - t0) / 1000;
    return m.u0 + m.amp * (Math.sin(2 * Math.PI * m.freq * t + m.phase) - Math.sin(m.phase)) + m.walk * t + adjust;
  }
  function shakeAt(now) {
    const pc = roll[frame], s = pc ? pc.m.shake : 0;
    if (!s || still) return { x: 0, y: 0 };
    const t = now / 1000;
    return { x: s * (Math.sin(t * 7.3) * 0.6 + Math.sin(t * 13.1) * 0.4), y: s * (Math.sin(t * 5.7 + 1) * 0.6 + Math.sin(t * 11.3) * 0.4) };
  }
  function digits(n, w) { const s = String(Math.max(0, Math.round(n))); return s.length >= w ? s : "0".repeat(w - s.length) + s; }
  function showCard(html, cls, noFocus) {
    card.className = "fg__card" + (cls ? " " + cls : "");
    card.innerHTML = html;
    card.hidden = false;
    root.classList.add("has-card");
    const b = card.querySelector(".fg__btn--solid") || card.querySelector("[data-fg]");
    if (noFocus) root.focus({ preventScroll: true });
    else if (b) b.focus({ preventScroll: true });
  }
  function hideCard() { card.hidden = true; root.classList.remove("has-card"); }
  function title() {
    state = "title";
    root.className = "fg is-title";
    modeEl.textContent = "";
    hintEl.textContent = "";
    const best = +store.get("focus-challenge-best") || 0, day = store.get("focus-challenge-day-" + dayKey);
    showCard(
      '<h2 class="fg__h">Focus challenge</h2>' +
      "<p>In the bright patch in the middle of the finder the photograph shows twice. <b>Hold, drag the second image onto the first, and let go</b>: letting go releases the shutter. Or just tap when they meet.</p>" +
      '<p class="fg__small">' + FRAMES + " frames to a roll. The subject keeps still at first, then sways, then walks off. Sharp frames in a row build a streak." +
      (touch ? "" : " Keys: ← → to line up, Space to shoot.") + "</p>" +
      '<div class="fg__row"><button class="fg__btn fg__btn--solid" type="button" data-fg="roll">Shoot a roll</button>' +
      '<button class="fg__btn" type="button" data-fg="day">Today\'s roll' + (day ? " · " + day + " pts" : "") + "</button></div>" +
      '<button class="fg__btn fg__btn--quiet fg__btn--guide" type="button" data-fg="guide">New to a rangefinder? How to focus one</button>' +
      (best ? '<p class="fg__small fg__best-line">Your best roll: ' + best + " points</p>" : ""),
      "fg__card--title"
    );
  }
  function begin(m, now) {
    closeView();
    const fromTitle = state === "title";
    makeRoll(m);
    results = []; total = 0; streak = 0; bestStreak = 0; frame = 0;
    slots.forEach((s) => { s.className = "fg__frm"; const im = s.querySelector("img"); im.removeAttribute("src"); im.style.filter = ""; });
    loadPic(0); loadPic(1); loadPic(2);
    hideCard();
    modeEl.textContent = m === "day" ? "Today's roll · " + dayLabel(dayKey) : m === "guide" ? "How to focus" : "A roll of " + FRAMES;
    scoreEl.textContent = "0";
    streakEl.textContent = "0";
    if (renderer && !still && view && fromTitle) {
      fly = { from: { pos: view.pos.clone(), look: view.look.clone() }, at: now };
      state = "lift";
    } else toPlay(now);
  }
  function toPlay(now) {
    root.className = "fg is-play";
    fly = null;
    resize();
    if (mode === "guide") startGuide(now);
    else startFrame(now + (still ? 0 : 350));
  }

  /* ---------- The guide: how a rangefinder is focused, step by step, in the same finder ---------- */
  // The hands-on steps say nothing while the images come together (no lamp, no beep, as on the
  // camera); only after the shutter does the guide say how close they were.
  const GUIDE = [
    { t: "The finder", hl: "frame", x: "On a Leica M, as on any rangefinder, you look through a window beside the lens, not through the lens itself. So the whole finder is always sharp, wherever the lens is focused, and the bright lines mark what the lens will take." },
    { t: "The patch", hl: "patch", x: "In the middle is a small, brighter patch. It shows the scene a second time, seen from another window a few centimetres along the camera, laid over the first. While the lens is not focused on what is in the patch, the two do not line up: you see it twice, side by side." },
    { t: "Inside the camera", td: true, x: "Under the top cover of a Leica M-style camera, light from your subject comes in through two windows a few centimetres apart. Through the big one it goes straight to your eye; through the small one it bounces off a mirror and a half-silvered mirror into the middle of the finder: the patch. Turning the focus ring moves a cam at the back of the lens, and a roller on it swings the mirror. Slide to focus nearer: the two images become one where the two paths meet." },
    { t: "An upright edge", hl: "patch", x: "The second image only ever moves sideways, so put the patch on something upright in your subject: the edge of a face, an eye, a doorframe, a tree trunk. Where there are only level lines, tilt the camera a little." },
    { t: "Turn the ring", act: "still", x: "On the camera you turn the lens's focus ring (on many Leica lenses by a small tab underneath, under one fingertip) and the second image slides across. Here, hold anywhere on the finder and drag. When the two images are one, let go: letting go is the shutter. Nothing lights up or beeps to tell you, just as on the camera: trust your eye." },
    { t: "Past it, and back", act: "still", x: "A habit of rangefinder photographers: turn a little past the point where the images meet, then back. The moment the doubling vanishes is easiest to see coming from either side. Try it, then let go." },
    { t: "A moving subject", act: "sway", x: "People move, and as they do the images part again. Keep them together as your subject moves and let go the moment they are one. On the street many Leica photographers focus ahead instead: they set a distance on the lens's scale and wait for the subject to step into it (zone focusing)." },
    { t: "The game", end: true, x: "A roll is " + FRAMES + " frames, and it gets harder: still, then swaying, then walking off, the hand shaking towards the end. Each frame is ranked by how closely the two images met when you let go: critically sharp, sharp, soft or missed. Sharp frames in a row build a streak, up to ×3, and quick ones score a bonus." }
  ];
  let gstep = 0, gdone = false, gnote = "", gShot = 0;
  function guideMotion(kind) {
    const sign = Math.random() < 0.5 ? -1 : 1;
    return kind === "sway"
      ? { u0: sign * 0.16, amp: 0.05, freq: 0.3, phase: Math.random() * 6.28, walk: 0, shake: 0, ms: 1e9 }
      : { u0: sign * (0.22 + 0.15 * Math.random()), amp: 0, freq: 0, phase: 0, walk: 0, shake: 0, ms: 1e9 };
  }
  function startGuide(now) {
    state = "guide";
    root.className = "fg is-play is-guide";
    gstep = 0;
    guideStep(now);
  }
  function guideStep(now) {
    hideCapture();
    const st = GUIDE[gstep];
    root.classList.toggle("is-teardown", !!st.td);
    if (st.td) openTeardown();
    gdone = !st.act;
    gnote = "";
    adjust = 0;
    holding = null;
    if (st.act || gstep === 0) roll[0].m = guideMotion(st.act || "still");
    t0 = now;
    renderGuide();
    need = true;
  }
  function renderGuide() {
    const st = GUIDE[gstep], n = GUIDE.length;
    modeEl.textContent = "How to focus · " + (gstep + 1) + " of " + n;
    // after any shot in a hands-on step, another go: a fresh start, as often as wanted
    const again = st.act && (gdone || gnote) ? '<button class="fg__btn" type="button" data-fg="gretry">Try again</button>' : "";
    const btns = st.end
      ? '<button class="fg__btn fg__btn--solid" type="button" data-fg="roll">Shoot a roll</button><button class="fg__btn" type="button" data-fg="day">Today\'s roll</button>'
      : (gdone ? '<button class="fg__btn fg__btn--solid" type="button" data-fg="gnext">Next</button>' : "") + again;
    showCard(
      '<p class="fg__step">' + (gstep + 1) + " / " + n + "</p>" +
      '<h2 class="fg__h">' + st.t + "</h2><p>" + st.x + "</p>" +
      (gnote ? '<p class="fg__note">' + gnote + "</p>" : "") +
      '<div class="fg__row">' + (gstep > 0 ? '<button class="fg__btn" type="button" data-fg="gback">Back</button>' : "") + btns +
      (st.end ? "" : '<button class="fg__btn fg__btn--quiet" type="button" data-fg="gskip">Skip the guide</button>') + "</div>",
      "fg__card--guide",
      !!st.act && !gdone
    );
  }
  // Inside the camera: the teardown drawn for five settings of the lens (assets/img/teardown,
  // made by _teardown/rangefinder), fetched once and swapped by the slider.
  const TD = [["inf", "∞", "infinity"], ["3m", "3 m", "3 metres"], ["1-5m", "1.5 m", "1.5 metres"], ["1m", "1 m", "1 metre"], ["0-7m", "0.7 m", "0.7 metres"]];
  const tdFig = $(".fg__td-fig"), tdIn = $("#fg-td-at"), tdOut = $(".fg__td-bar output");
  let tdLoaded = false;
  function tdShow(k) {
    tdOut.textContent = TD[k][1];
    tdIn.setAttribute("aria-valuetext", TD[k][2]);
    Array.prototype.forEach.call(tdFig.children, (d, i) => d.classList.toggle("is-on", i === k));
  }
  function openTeardown() {
    if (tdLoaded) return;
    tdLoaded = true;
    TD.forEach(([slug], i) => {
      const d = document.createElement("div");
      tdFig.appendChild(d);
      fetch(new URL("../img/teardown/rangefinder-" + slug + ".svg", import.meta.url)).then((r) => (r.ok ? r.text() : "")).then((t) => {
        // our own drawing; the ids repeat from one setting to the next, so they go
        d.innerHTML = t.replace(/<\?xml[^>]*>/, "").replace(/ id="[^"]*"/g, "");
        if (i === +tdIn.value) d.classList.add("is-on");
      }, () => {});
    });
    tdShow(+tdIn.value);
  }
  tdIn.addEventListener("input", () => tdShow(+tdIn.value));

  // letting go in a hands-on step: the shutter, then how close the two images were
  function guideShoot(now) {
    const st = GUIDE[gstep];
    if (state !== "guide" || !st.act || gdone) return;
    const u = offsetAt(now), rk = rankOf(Math.abs(u));
    holding = null;
    root.classList.remove("is-holding");
    snd.shutter();
    buzz(16);
    if (!still) { curtain.classList.remove("is-go"); void curtain.offsetWidth; curtain.classList.add("is-go"); }
    if (sharpish(rk)) {
      gdone = true;
      gShot = u;
      gnote = "<b>" + rk.name + ".</b> " + (rk === RANKS[0] ? "The two images were one." : "The two images were all but one.") + (st.act === "sway" ? " Caught as it moved." : "");
    } else {
      gnote = "<b>" + rk.name + ".</b> The two images were still apart. Look at the patch again, and try once more.";
      roll[0].m = guideMotion(st.act);
      adjust = 0;
      t0 = now;
    }
    srEl.textContent = rk.name + ".";
    const tok = showCapture(roll[0], Math.abs(u));
    setTimeout(() => { if (tok === capTok) hideCapture(); }, still ? 1400 : 2200);
    renderGuide();
    need = true;
  }
  function guideFrame(now) {
    const st = GUIDE[gstep];
    drawFinder(st.act && gdone ? gShot : offsetAt(now), { x: 0, y: 0 }, st.hl || null);
  }
  function startFrame(at) {
    hideCapture();
    state = "play";
    adjust = 0;
    holding = null;
    t0 = at;
    loadPic(frame + 1); loadPic(frame + 2);
    countEl.textContent = pad2(frame + 1);
    slots.forEach((s, k) => s.classList.toggle("is-now", k === frame));
    hintEl.textContent = frame === 0 ? "Hold and drag the second image onto the first, then let go" : "";
    pop.className = "fg__pop";
    need = true;
    root.focus({ preventScroll: true });
  }
  function shoot(now, late) {
    if (state !== "play" || now < t0) return;
    const pc = roll[frame], m = pc.m;
    const u = offsetAt(now), e = Math.abs(u), rk = rankOf(e), used = clamp(now - t0, 0, m.ms);
    const speed = late ? 0 : 1 - used / m.ms;
    if (sharpish(rk)) streak++; else streak = 0;
    bestStreak = Math.max(bestStreak, streak);
    const mult = sharpish(rk) ? 1 + Math.min(streak - 1, 4) * 0.5 : 1;
    const pts = Math.round((rk.pts + (sharpish(rk) ? 30 * speed : 0)) * mult);
    total += pts;
    results.push({ k: frame, e, rank: rk, pts, mult, late, used, p: pc.p });
    holding = null;
    state = "shot";
    // the shutter, the frame onto the roll, the film on
    snd.shutter();
    buzz(16);
    if (!still) { curtain.classList.remove("is-go"); void curtain.offsetWidth; curtain.classList.add("is-go"); }
    shotU = u;
    need = true;
    const slot = slots[frame], im = slot.querySelector("img");
    im.src = pc.p.thumb;
    im.style.filter = blurOf(e);
    slot.classList.remove("is-now");
    slot.classList.add("is-done", "is-" + rk.name.split(" ")[0].toLowerCase());
    pop.innerHTML = "<b>" + rk.name + "</b>" + (late ? "<span>Out of time</span>" : "") + "<span>+" + pts + (mult > 1 ? " · ×" + mult : "") + "</span>";
    pop.className = "fg__pop is-on is-" + rk.name.split(" ")[0].toLowerCase();
    scoreEl.textContent = String(total);
    streakEl.textContent = String(streak);
    root.classList.toggle("is-streak", streak >= 2);
    if (streak >= 2) snd.streak(streak);
    srEl.textContent = "Frame " + (frame + 1) + ": " + rk.name + (late ? ", out of time" : "") + ", " + pts + " points" + (streak >= 2 ? ", streak " + streak : "") + ".";
    showCapture(pc, e);
    hintEl.textContent = "Tap to go on";
    nextAt = now + (still ? 1200 : 1900);
    setTimeout(() => snd.advance(), 380);
  }
  // After each exposure the frame as it came out fills the finder for a moment: the whole
  // photograph, blurred as far as the two images were apart (in proportion to the gap in the
  // patch, so the blur on screen matches what was seen there).
  let capTok = 0;
  function showCapture(pc, e) {
    const tok = ++capTok;
    cap.src = pc.full ? pc.p.src : pc.p.thumb;
    cap.style.filter = e <= RANKS[0].max ? "none" : "blur(" + Math.min(28, e * patchCss * 0.5).toFixed(2) + "px)";
    finder.classList.add("is-review");
    requestAnimationFrame(() => { if (tok === capTok) cap.classList.add("is-on"); });
    return tok;
  }
  function hideCapture() {
    capTok++;
    cap.classList.remove("is-on");
    finder.classList.remove("is-review");
  }
  // how a frame came out on the little print: the further apart the two images, the softer
  function blurOf(e) { return e <= RANKS[0].max ? "none" : "blur(" + Math.min(9, e * 110).toFixed(2) + "px)"; }
  function next(now) {
    frame++;
    if (frame >= FRAMES) { sheet(); return; }
    startFrame(now + 120);
  }
  function sheet() {
    hideCapture();
    state = "sheet";
    pop.className = "fg__pop";
    const sharp = results.filter((r) => sharpish(r.rank)).length;
    const marks = results.map((r) => r.rank.mark).join("");
    let bestNote = "";
    if (mode === "day") {
      const prev = +store.get("focus-challenge-day-" + dayKey) || 0;
      if (total > prev) store.set("focus-challenge-day-" + dayKey, String(total));
    }
    const best = +store.get("focus-challenge-best") || 0;
    if (total > best) { store.set("focus-challenge-best", String(total)); bestNote = ' <span class="fg__best">best yet</span>'; }
    const share = "Focus challenge" + (mode === "day" ? ", today's roll (" + dayLabel(dayKey) + ")" : "") + ": " + sharp + "/" + FRAMES + " sharp, " + total + " points\n" + marks + "\n" + location.origin + "/photography/";
    root.className = "fg is-play is-done";
    showCard(
      '<header class="fg__sheet-head"><h2 class="fg__h">' + total + " points" + bestNote + "</h2>" +
      "<p>" + sharp + " of " + FRAMES + " frames sharp · best streak " + bestStreak + "</p></header>" +
      '<ol class="fg__sheet">' + results.map((r) =>
        '<li class="is-' + r.rank.name.split(" ")[0].toLowerCase() + '"><button class="fg__shot" type="button" data-fg="view" data-k="' + r.k + '" aria-label="See frame ' + (r.k + 1) + ", " + r.rank.name + '"><img src="' + r.p.thumb + '" alt="" draggable="false" data-e="' + r.e + '"></button>' +
        '<span class="fg__edge">' + (r.k + 1) + "</span><span class=\"fg__rank\">" + r.rank.name + "</span><span class=\"fg__pts\">+" + r.pts + "</span></li>").join("") + "</ol>" +
      '<p class="fg__marks" aria-label="' + sharp + " of " + FRAMES + ' sharp">' + marks + "</p>" +
      '<div class="fg__row"><button class="fg__btn fg__btn--solid" type="button" data-fg="roll">Shoot another roll</button>' +
      (mode !== "day" ? '<button class="fg__btn" type="button" data-fg="day">Today\'s roll</button>' : "") +
      '<button class="fg__btn" type="button" data-fg="share" data-share="' + share.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">Share score</button>' +
      '<button class="fg__btn" type="button" data-fg="close">Back to the photograph</button></div>',
      "fg__card--sheet"
    );
    // each little frame blurred in proportion to its own size, as the big one is
    requestAnimationFrame(() => card.querySelectorAll(".fg__shot img").forEach((im) => { im.style.filter = blurFor(+im.getAttribute("data-e"), im.clientWidth); }));
    srEl.textContent = "Roll done: " + total + " points, " + sharp + " of " + FRAMES + " frames sharp. Choose a frame to see it.";
  }

  // How a frame came out at a given width on screen: the same blur, for its size, as the frame
  // shown in the finder after the exposure (about 15% of the gap per pixel of width).
  function blurFor(e, w) { return e <= RANKS[0].max || !w ? "none" : "blur(" + Math.min(w * 0.05, e * 0.15 * w).toFixed(2) + "px)"; }
  /* ---------- After the roll: any frame, large, as it came out ---------- */
  let viewK = -1, viewFrom = null;
  function openView(k, from) {
    if (k < 0 || k >= results.length) return;
    if (viewK < 0) viewFrom = from || null;
    viewK = k;
    const r = results[k];
    viewImg.style.filter = "";
    viewImg.onload = () => { viewImg.style.filter = blurFor(r.e, viewImg.getBoundingClientRect().width || viewImg.clientWidth); };
    viewImg.src = r.p.src;
    if (viewImg.complete && viewImg.naturalWidth) viewImg.onload();
    viewCap.innerHTML = "<b>Frame " + (r.k + 1) + "</b><span>" + r.rank.name + "</span><span>+" + r.pts + (r.mult > 1 ? " · ×" + r.mult : "") + "</span>" + (r.late ? "<span>Out of time</span>" : "");
    viewEl.hidden = false;
    root.classList.add("is-viewing");
    viewEl.querySelector('[data-v="prev"]').disabled = k === 0;
    viewEl.querySelector('[data-v="next"]').disabled = k === results.length - 1;
    const back = viewEl.querySelector('[data-v="back"]');
    if (document.activeElement && !viewEl.contains(document.activeElement)) back.focus({ preventScroll: true });
  }
  function closeView() {
    if (viewK < 0) return;
    viewK = -1;
    viewEl.hidden = true;
    root.classList.remove("is-viewing");
    if (viewFrom && viewFrom.focus) viewFrom.focus({ preventScroll: true });
    viewFrom = null;
  }
  viewEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) { if (e.target === viewEl) closeView(); return; }
    const a = b.getAttribute("data-v");
    if (a === "back") closeView();
    else if (a === "prev") openView(viewK - 1);
    else if (a === "next") openView(viewK + 1);
  });

  /* ---------- Hands on ---------- */
  card.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fg]");
    if (!b) return;
    const a = b.getAttribute("data-fg"), now = performance.now();
    if (a === "roll" || a === "day" || a === "guide") begin(a, now);
    else if (a === "gnext") { gstep = Math.min(GUIDE.length - 1, gstep + 1); guideStep(now); }
    else if (a === "gback") { gstep = Math.max(0, gstep - 1); guideStep(now); }
    else if (a === "gretry") guideStep(now);
    else if (a === "gskip") { gstep = GUIDE.length - 1; guideStep(now); }
    else if (a === "close") close();
    else if (a === "view") openView(+b.getAttribute("data-k"), b);
    else if (a === "share") {
      const text = b.getAttribute("data-share");
      const done = () => { b.textContent = "Copied"; setTimeout(() => { b.textContent = "Share score"; }, 1600); };
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
    }
  });
  $(".fg__x").addEventListener("click", () => close());
  // Hold anywhere on the finder and drag: the second image follows (a little slower than the
  // finger, so its tremble matters less); let go and the shutter goes.
  const canAim = () => (state === "play" && performance.now() >= t0) || (state === "guide" && !!GUIDE[gstep].act && !gdone);
  finder.addEventListener("pointerdown", (e) => {
    if (state === "shot") { nextAt = 0; return; }
    if (!canAim()) return;
    holding = { id: e.pointerId, x: e.clientX };
    try { finder.setPointerCapture(e.pointerId); } catch (x) {}
    root.classList.add("is-holding");
    hintEl.textContent = "";
  });
  finder.addEventListener("pointermove", (e) => {
    if (!holding || e.pointerId !== holding.id) return;
    const dx = e.clientX - holding.x;
    holding.x = e.clientX;
    adjust += (dx * GAIN) / patchCss;
  });
  const letGo = (e, cancel) => {
    if (!holding || e.pointerId !== holding.id) return;
    holding = null;
    root.classList.remove("is-holding");
    if (cancel) return;
    if (state === "guide") guideShoot(performance.now());
    else shoot(performance.now(), false);
  };
  finder.addEventListener("pointerup", (e) => letGo(e, false));
  finder.addEventListener("pointercancel", (e) => letGo(e, true));
  root.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!canAim()) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    adjust += (d * (e.deltaMode === 1 ? 16 : 1) * 0.35) / patchCss;
  }, { passive: false });
  // the keys: arrows line up (held down, faster; Shift, much faster), Space or Enter shoots,
  // Escape goes back to the photograph
  function onKey(e) {
    if (closed || !host.open) return;
    const k = e.key;
    // the teardown's slider takes its own arrows and keys
    if (e.target === tdIn && k !== "Escape") return;
    if (viewK >= 0 && (k === "Escape" || k === "ArrowLeft" || k === "ArrowRight")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (k === "Escape") closeView(); else openView(viewK + (k === "ArrowRight" ? 1 : -1));
      return;
    }
    if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!canAim()) return;
      keyRep = e.repeat ? keyRep + 1 : 0;
      const step = (e.shiftKey ? 0.03 : 0.004) * Math.min(4, 1 + keyRep * 0.25);
      adjust += k === "ArrowRight" ? step : -step;
      return;
    }
    if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if ((k === " " || k === "Enter") && !(e.target && e.target.closest && e.target.closest("button"))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state === "play") shoot(performance.now(), false);
      else if (state === "shot") nextAt = 0;
      else if (state === "guide") guideShoot(performance.now());
      else if (state === "title") begin("roll", performance.now());
    }
  }
  window.addEventListener("keydown", onKey, true);
  function onCancel(e) { e.preventDefault(); e.stopImmediatePropagation(); if (viewK >= 0) closeView(); else close(); }
  host.addEventListener("cancel", onCancel, true);

  /* ---------- Sizing and drawing ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fr = finder.getBoundingClientRect();
    if (fr.width && fr.height) {
      vf.width = Math.round(fr.width * dpr);
      vf.height = Math.round(fr.height * dpr);
      patchCss = geom().pw / dpr;
    }
    if (renderer) {
      const cr = gl.getBoundingClientRect();
      if (cr.width && cr.height) {
        renderer.setPixelRatio(dpr);
        renderer.setSize(cr.width, cr.height, false);
        cam.aspect = cr.width / cr.height;
        cam.fov = cam.aspect < 1 ? 38 : 28;
        cam.updateProjectionMatrix();
      }
    }
    need = true;
  }
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(root); else window.addEventListener("resize", resize);

  function frameLoop(now) {
    raf = requestAnimationFrame(frameLoop);
    if (held && state === "play" && now > t0) t0 = Math.min(now, t0 + now - lastNow);
    lastNow = now;
    // the title camera: turning slowly, then lifted to the eye
    if (renderer && (state === "title" || state === "lift")) {
      if (state === "title") view = still ? orbit(0) : orbit(now);
      else {
        const k = clamp((now - fly.at) / 1100, 0, 1);
        view = flyAt(k);
        if (k >= 1) toPlay(now);
      }
      cam.position.copy(view.pos);
      cam.lookAt(view.look);
      renderer.render(scene, cam);
    }
    if (state === "play") {
      const pc = roll[frame], left = pc.m.ms - Math.max(0, now - t0);
      timeEl.style.transform = "scaleX(" + clamp(left / pc.m.ms, 0, 1).toFixed(4) + ")";
      root.classList.toggle("is-late", left < 1200);
      drawFinder(offsetAt(now), shakeAt(now), null);
      if (left <= 0 && now >= t0) shoot(now, true);
    } else if (state === "shot") {
      if (now >= nextAt) next(now);
      else if (need) { drawFinder(shotU, { x: 0, y: 0 }, null); need = false; }
    } else if (state === "guide") {
      guideFrame(now);
    } else if (need && (state === "sheet")) {
      drawFinder(0, { x: 0, y: 0 }, null);
    }
    need = false;
  }

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey, true);
    host.removeEventListener("cancel", onCancel, true);
    if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
    snd.close();
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
  title();
  raf = requestAnimationFrame(frameLoop);
  return {
    close,
    // for tests
    test: {
      state: () => state,
      // (with the clock held, at the time of the last frame drawn, where the game's time stands)
      offset: () => offsetAt(held ? Math.max(lastNow, t0) : performance.now()),
      alignTo: (u) => { adjust += u - offsetAt(held ? Math.max(lastNow, t0) : performance.now()); },
      shoot: () => shoot(held ? Math.max(lastNow, t0) : performance.now(), false),
      hold: (on) => { held = !!on; },
      results: () => results.map((r) => ({ k: r.k, e: r.e, rank: r.rank.name, pts: r.pts, mult: r.mult, late: r.late })),
      total: () => total,
      frame: () => frame,
      begin: (m) => begin(m, performance.now()),
      roll: () => roll.map((r) => ({ src: r.p.src, m: r.m })),
      patch: () => patchCss,
      guide: () => ({ step: gstep, done: gdone, note: gnote, title: GUIDE[gstep].t }),
      teardown: () => ({ shown: root.classList.contains("is-teardown"), value: +tdIn.value, out: tdOut.textContent, on: Array.prototype.findIndex.call(tdFig.children, (d) => d.classList.contains("is-on")), loaded: Array.prototype.filter.call(tdFig.children, (d) => !!d.querySelector("svg")).length }),
      guideShoot: () => guideShoot(held ? Math.max(lastNow, t0) : performance.now()),
      view: () => ({ k: viewK, open: !viewEl.hidden, filter: viewImg.style.filter, cap: viewCap.textContent, w: viewImg.getBoundingClientRect().width }),
      capture: () => ({ on: cap.classList.contains("is-on"), filter: cap.style.filter, src: cap.getAttribute("src") })
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
