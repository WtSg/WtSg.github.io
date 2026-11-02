/*
 * Photography: the darkroom, in 3D.
 *
 * A wet bench under a red safelight, at the front of a drying room that goes
 * on without end. Each print is made the way a darkroom makes it: a sheet
 * comes out of the paper safe onto the enlarger's easel, the enlarger projects
 * the negative onto it, it comes up in the developer under the rippling
 * liquid, goes through the stop bath and the fixer in the tongs, and is
 * clipped to the drying line. Scrolling drives every step, both ways.
 *
 * By hand: drag a tray to rock it, brush or flick a hanging print to swing
 * it, press the enlarger (or its timer) to switch its lamp on. Lights on
 * catches the fluorescent tubes row by row down the endless room; drag (or
 * scroll) to wander along the lines and open any print.
 *
 * darkroom.js loads this only where WebGL works; the flat darkroom is the
 * fallback. Photographs keep their own colours: the safelight tints the room
 * and the paper, never a developed image.
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const E = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t
};
const seg = (f, a, b) => clamp((f - a) / (b - a), 0, 1);
const mod = (a, n) => ((a % n) + n) % n;

function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Scene constants (metres; the bench top is y = 0) ---------- */
const WALL_Z = -0.62;            // the tiled splash-back behind the bench
const SPLASH_H = 0.42;
const LINE_Z = -0.5;             // the drying line over the bench
const FLOOR_Y = -0.92;
const BENCH = { x0: -1.72, x1: 1.6, z0: -0.62, z1: 0.5 };
const TRAY = { w: 0.44, d: 0.35, h: 0.055, wall: 0.012 };
const TRAYS = [
  { key: "dev", x: 0, z: 0 },
  { key: "stop", x: 0.56, z: 0.015 },
  { key: "fix", x: 1.12, z: -0.005 }
];
const LIQ_Y = 0.036;
const PRINT_Y = 0.011;
const ENL_X = -0.95;
const EASEL = V(ENL_X, 0.032, -0.03);
const LENS = V(ENL_X, 0.668, -0.04);
const SAFE = V(-1.44, 0, 0.17);
const LINE = { x0: -1.42, x1: 1.42, y: 1.16, sag: 0.075 };
const LAMP = V(0.34, 1.42, -0.46);
// The drying room: rows of lines behind the bench, repeating without end.
const HALL = { z0: -1.62, gap: 1.06, rows: 10, y: 1.2, per: 20, lampY: 2.04, tubeY: 2.42, bay: 2.8 };
const DEV_SHOWN = 90;
const EXP_SECONDS = 8;
const FLICKER = [0.7, 0.05, 0.45, 0.1, 0.9];

/* Development: blank paper, then shadows, then mid-tones, then colour. */
const DEV_KEYS = [
  [0, 0.18, 3.2, 0],
  [0.3, 0.62, 1.75, 0],
  [0.62, 0.98, 1.16, 0.45],
  [1, 1, 1, 1]
];
function devAt(k) {
  for (let i = 1; i < DEV_KEYS.length; i++) {
    const a = DEV_KEYS[i - 1], b = DEV_KEYS[i];
    if (k <= b[0]) {
      const t = smooth((k - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  return [1, 1, 1];
}

/* ---------- Procedural textures ---------- */
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function texFrom(canvas, { srgb = false, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}
/* Liquid and glass without refraction: only the surface's reflections, laid over
   what lies under it, which shows through a little dimmed. Refraction draws the
   room a second time every frame; phones go without it, and so does any GPU
   that draws the room black with it. */
function plainClear(m, dim) {
  m.transmission = 0;
  m.color.setRGB(0, 0, 0);
  m.transparent = true;
  m.opacity = dim;
  m.depthWrite = false;
  m.blending = THREE.CustomBlending;
  m.blendSrc = m.blendSrcAlpha = THREE.OneFactor;
  m.blendDst = m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.needsUpdate = true;
}
/* Smooth value noise: a random grid drawn up with bilinear smoothing. */
function noiseLayer(size, cells, r) {
  const small = makeCanvas(cells, cells), g = small.getContext("2d");
  const img = g.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) {
    const v = r() * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const big = makeCanvas(size, size), bg = big.getContext("2d");
  bg.imageSmoothingEnabled = true;
  bg.imageSmoothingQuality = "high";
  bg.drawImage(small, 0, 0, size, size);
  return big;
}
function heightToNormal(h, w, hgt, strength) {
  const c = makeCanvas(w, hgt), g = c.getContext("2d"), img = g.createImageData(w, hgt);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
      const u = h[((y - 1 + hgt) % hgt) * w + x], d = h[((y + 1) % hgt) * w + x];
      const nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      img.data[i] = (nx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function benchTextures() {
  const r = rng(11), S = 1024;
  // Colour: dark slate laminate with faint mottling and old chemical stains.
  const col = makeCanvas(S, S), g = col.getContext("2d");
  g.fillStyle = "#1c1816";
  g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.18;
  g.globalCompositeOperation = "overlay";
  g.drawImage(noiseLayer(S, 24, r), 0, 0);
  g.drawImage(noiseLayer(S, 96, r), 0, 0);
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 90;
    const grd = g.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    grd.addColorStop(0, "rgba(70,52,30,0.10)");
    grd.addColorStop(0.8, "rgba(60,44,26,0.05)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 1;
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  // Roughness: satin laminate, glossy where the bench is wet (around the trays).
  const rough = makeCanvas(S, S), rg = rough.getContext("2d");
  rg.fillStyle = "rgb(150,150,150)";
  rg.fillRect(0, 0, S, S);
  rg.globalAlpha = 0.25;
  rg.drawImage(noiseLayer(S, 48, r), 0, 0);
  rg.globalAlpha = 1;
  const wet = (u, v, rx, ry, a) => {
    const x = u * S, y = v * S;
    rg.save();
    rg.translate(x, y);
    rg.scale(1, ry / rx);
    const grd = rg.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    grd.addColorStop(0, `rgba(18,18,18,${a})`);
    grd.addColorStop(0.7, `rgba(30,30,30,${a * 0.7})`);
    grd.addColorStop(1, "rgba(60,60,60,0)");
    rg.fillStyle = grd;
    rg.beginPath();
    rg.arc(0, 0, rx, 0, Math.PI * 2);
    rg.fill();
    rg.restore();
  };
  const U = (x) => (x - BENCH.x0) / (BENCH.x1 - BENCH.x0), Vv = (z) => (z - BENCH.z0) / (BENCH.z1 - BENCH.z0);
  for (let i = 0; i < 40; i++) {
    const t = TRAYS[Math.floor(r() * 3)];
    wet(U(t.x + (r() - 0.5) * 0.7), Vv(t.z + (r() - 0.5) * 0.6), 8 + r() * 40, 6 + r() * 26, 0.6 + r() * 0.4);
  }
  for (let i = 0; i < 70; i++) {
    // droplets
    wet(U(-0.4 + r() * 1.9), Vv(-0.35 + r() * 0.75), 2 + r() * 5, 2 + r() * 5, 1);
  }
  // Fine grain for the normal map.
  const N = 512, h = new Float32Array(N * N), gr = noiseLayer(N, 256, r).getContext("2d").getImageData(0, 0, N, N).data;
  for (let i = 0; i < N * N; i++) h[i] = gr[i * 4] / 255 + (r() - 0.5) * 0.12;
  const nrm = heightToNormal(h, N, N, 1.2);
  return {
    map: texFrom(col, { srgb: true }),
    roughnessMap: texFrom(rough),
    normalMap: texFrom(nrm, { repeat: [4, 2] })
  };
}

function tileTextures(repeat) {
  // Glazed square tiles with grout; one texture covers 6 x 6 tiles.
  const r = rng(29), S = 1024, T = 6, ts = S / T, gw = 7;
  const col = makeCanvas(S, S), g = col.getContext("2d");
  const rough = makeCanvas(S, S), rg = rough.getContext("2d");
  const H = new Float32Array(256 * 256);
  g.fillStyle = "#2c2c2c";
  g.fillRect(0, 0, S, S);
  rg.fillStyle = "rgb(235,235,235)";
  rg.fillRect(0, 0, S, S);
  for (let ty = 0; ty < T; ty++) {
    for (let tx = 0; tx < T; tx++) {
      const l = 78 + Math.floor((r() - 0.5) * 12);
      const x = tx * ts + gw / 2, y = ty * ts + gw / 2, s = ts - gw;
      const grd = g.createLinearGradient(x, y, x + s, y + s);
      grd.addColorStop(0, `rgb(${l + 6},${l + 6},${l + 6})`);
      grd.addColorStop(1, `rgb(${l - 8},${l - 8},${l - 8})`);
      g.fillStyle = grd;
      g.fillRect(x, y, s, s);
      const rv = 105 + Math.floor(r() * 30);
      rg.fillStyle = `rgb(${rv},${rv},${rv})`;
      rg.fillRect(x, y, s, s);
    }
  }
  // height: tiles raised with a soft bevel, grout recessed
  const hs = 256, hts = hs / T, hg = 2.2;
  for (let y = 0; y < hs; y++) {
    for (let x = 0; x < hs; x++) {
      const fx = (x % hts), fy = (y % hts);
      const e = Math.min(fx, fy, hts - fx, hts - fy);
      H[y * hs + x] = clamp((e - hg * 0.5) / 2.5, 0, 1);
    }
  }
  const nrm = heightToNormal(H, hs, hs, 2.2);
  return {
    map: texFrom(col, { srgb: true, repeat }),
    roughnessMap: texFrom(rough, { repeat }),
    normalMap: texFrom(nrm, { repeat })
  };
}

function labelTexture(text, rot) {
  const c = makeCanvas(256, 128), g = c.getContext("2d");
  const draw = () => {
    g.fillStyle = "#d9c9a5";
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, 0, 256, 40);
    g.save();
    g.translate(128, 66);
    g.rotate(rot);
    g.fillStyle = "#1f1b16";
    g.font = '64px "Permanent Marker", "Marker Felt", cursive';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 0);
    g.restore();
  };
  draw();
  const t = texFrom(c, { srgb: true });
  if (document.fonts && document.fonts.load) {
    document.fonts.load('64px "Permanent Marker"').then(() => { draw(); t.needsUpdate = true; }, () => {});
  }
  return t;
}

/* The enlarger timer's red seven-segment readout, drawn over its unlit segments. */
function ledTexture() {
  const c = makeCanvas(256, 112), g = c.getContext("2d");
  const tex = texFrom(c, { srgb: true });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  let val = "8.0", seg7 = false;
  function draw() {
    g.fillStyle = "#140403";
    g.fillRect(0, 0, 256, 112);
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.font = seg7 ? '700 70px "DSEG7"' : '700 64px "Barlow Condensed", "Arial Narrow", sans-serif';
    if (seg7) {
      g.fillStyle = "rgba(255, 70, 40, 0.07)";
      g.fillText("8.8", 226, 58);
    }
    g.fillStyle = "#ff3a20";
    g.fillText(val, 226, 58);
    tex.needsUpdate = true;
  }
  draw();
  try {
    const url = new URL("../fonts/dseg7-classic-bold.woff2", import.meta.url).href;
    const face = new FontFace("DSEG7", `url(${url})`, { weight: "700" });
    face.load().then((f) => { document.fonts.add(f); seg7 = true; draw(); }, () => {});
  } catch (e) { /* the condensed face stands in */ }
  return { tex, set(v) { if (v !== val) { val = v; draw(); } } };
}

/* A soft round pool of light, for the floor under each safelight in the drying room. */
function poolTexture() {
  const c = makeCanvas(128, 128), g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.28)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = texFrom(c, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ---------- Geometry helpers ---------- */
function rrShape(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/* Write a translate · rotate-about-z · offset · scale matrix straight into an instance buffer. */
function writeTRS(arr, i, x, y, z, c, s, ox, oy, oz, sx, sy, sz) {
  const o = i * 16;
  arr[o] = c * sx; arr[o + 1] = s * sx; arr[o + 2] = 0; arr[o + 3] = 0;
  arr[o + 4] = -s * sy; arr[o + 5] = c * sy; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = sz; arr[o + 11] = 0;
  arr[o + 12] = x + c * ox - s * oy; arr[o + 13] = y + s * ox + c * oy; arr[o + 14] = z + oz; arr[o + 15] = 1;
}

/* ---------- Main ---------- */
export function start(o) {
  const { canvas, stage, photos } = o;
  const reduce = !!o.reduce;
  const N = photos.length;
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const SAFE_BG = new THREE.Color(0x070202), LIT_BG = new THREE.Color(0x8a8a86);
  const FOG = { safe: [3.0, 14], lit: [3.0, 13] };
  scene.background = SAFE_BG.clone();
  scene.fog = new THREE.Fog(0x070202, 3.0, 14);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 40);

  /* Environment for reflections: the dark room with its red lamps, or the lit room. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let safeEnv = null, litEnv = null;

  /* ---------- Materials ---------- */
  const bt = benchTextures();
  const benchMat = new THREE.MeshPhysicalMaterial({
    map: bt.map, roughnessMap: bt.roughnessMap, roughness: 1, normalMap: bt.normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18), clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9
  });
  const BW = BENCH.x1 - BENCH.x0, BD = BENCH.z1 - BENCH.z0, BX = (BENCH.x0 + BENCH.x1) / 2, BZ = (BENCH.z0 + BENCH.z1) / 2;
  const tt = tileTextures([BW / 0.9, SPLASH_H / 0.9]);
  const tileMat = new THREE.MeshStandardMaterial({
    map: tt.map, roughnessMap: tt.roughnessMap, roughness: 1, normalMap: tt.normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.5
  });
  const trayMat = new THREE.MeshPhysicalMaterial({ color: 0x2c2a29, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const trayFloorMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1c, roughness: 0.45 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.38, metalness: 0.85 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.55, metalness: 0.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb38552, roughness: 0.72 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.62 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2208, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0 });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.8 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x161413, roughness: 0.6, envMapIntensity: 0.5 });

  /* ---------- Room: the bench, its splash-back, and the floor of the drying room ---------- */
  const bench = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.06, BD), benchMat);
  bench.position.set(BX, -0.03, BZ);
  bench.receiveShadow = true;
  scene.add(bench);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.04, -FLOOR_Y - 0.06, BD - 0.04), cabinetMat);
  cabinet.position.set(BX, (FLOOR_Y - 0.06) / 2, BZ);
  scene.add(cabinet);
  const splashWall = new THREE.Mesh(new THREE.PlaneGeometry(BW, SPLASH_H), tileMat);
  splashWall.position.set(BX, SPLASH_H / 2, WALL_Z);
  splashWall.receiveShadow = true;
  scene.add(splashWall);
  const splashCap = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.022, 0.07), new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.4 }));
  splashCap.position.set(BX, SPLASH_H + 0.011, WALL_Z - 0.02);
  splashCap.castShadow = splashCap.receiveShadow = true;
  scene.add(splashCap);
  // The back of the splash-back, seen from the drying room.
  const splashBack = new THREE.Mesh(new THREE.BoxGeometry(BW, SPLASH_H - FLOOR_Y, 0.04), cabinetMat);
  splashBack.position.set(BX, (SPLASH_H + FLOOR_Y) / 2, WALL_Z - 0.022);
  scene.add(splashBack);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  /* ---------- Trays with liquid ---------- */
  const U = { time: { value: 0 } };
  // Everything see-through, with how much it dims what lies under it without refraction.
  const clearMats = [];
  function clearMat(m, dim) {
    clearMats.push({ m, dim });
    if (coarse) plainClear(m, dim);
    return m;
  }
  function makeTray(spec, idx) {
    const g = new THREE.Group();
    g.position.set(spec.x, 0, spec.z);
    const outer = rrShape(TRAY.w, TRAY.d, 0.032);
    outer.holes.push(rrShape(TRAY.w - 2 * TRAY.wall, TRAY.d - 2 * TRAY.wall, 0.022));
    const wg = new THREE.ExtrudeGeometry(outer, { depth: TRAY.h, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0035, bevelSegments: 3, curveSegments: 10 });
    wg.rotateX(-Math.PI / 2);
    wg.translate(0, 0.004, 0);
    const walls = new THREE.Mesh(wg, trayMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    g.add(walls);
    const fg = new THREE.ShapeGeometry(rrShape(TRAY.w - 2 * TRAY.wall + 0.006, TRAY.d - 2 * TRAY.wall + 0.006, 0.024), 10);
    fg.rotateX(-Math.PI / 2);
    const floorM = new THREE.Mesh(fg, trayFloorMat);
    floorM.position.y = 0.004;
    floorM.receiveShadow = true;
    g.add(floorM);
    for (let i = -1; i <= 1; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(TRAY.w - 0.08, 0.005, 0.01), trayFloorMat);
      rib.position.set(0, 0.0065, i * 0.09);
      rib.receiveShadow = true;
      g.add(rib);
    }
    const liquidMat = clearMat(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.08, ior: 1.34,
      attenuationColor: new THREE.Color(spec.key === "stop" ? 0xf2e2b8 : 0xf3ece0), attenuationDistance: 0.45,
      specularIntensity: 1, envMapIntensity: 1.6
    }), 0.08);
    const lu = {
      uTime: U.time,
      uCenter: { value: new THREE.Vector2(spec.x, spec.z) },
      uDrop: { value: new THREE.Vector3(0, 0, -100) },
      uAgit: { value: 0.12 },
      uSlosh: { value: new THREE.Vector3(0, 0, 0) }
    };
    liquidMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, lu);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vLP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvLP = (modelMatrix * vec4(transformed, 1.0)).xz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vLP;\nuniform float uTime;\nuniform vec2 uCenter;\nuniform vec3 uDrop;\nuniform float uAgit;\nuniform vec3 uSlosh;")
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          {
            vec2 q = vLP - uCenter;
            float t = uTime;
            vec2 g = vec2(0.0);
            // the tray is rocked: long slow swells plus a finer criss-cross
            g += uAgit * vec2(0.9 * cos(q.x * 26.0 - t * 2.2), 0.6 * cos(q.y * 29.0 + t * 1.7));
            g += uAgit * 0.5 * vec2(cos((q.x + q.y) * 61.0 - t * 3.3), cos((q.x - q.y) * 57.0 + t * 2.9));
            // rocked by hand: the developer runs from one end of the tray to the other
            float sl = dot(q, uSlosh.xy);
            g += uSlosh.xy * uSlosh.z * (1.4 * cos(sl * 34.0 - t * 4.0) + 0.6 * cos(sl * 71.0 + t * 5.3));
            // a ring spreading from where the paper went in or came out
            float age = t - uDrop.z;
            if (age > 0.0 && age < 4.5) {
              vec2 dv = q - uDrop.xy;
              float d = length(dv) + 1e-4;
              // squared by hand: pow() of a negative number is undefined, and black on some GPUs
              float off = (d - age * 0.24) * 11.0;
              float band = exp(-off * off);
              float env = exp(-age * 1.15) * (band + 0.35 * exp(-d * 9.0) * exp(-age * 2.5));
              g += (dv / d) * env * 1.5 * cos(d * 82.0 - age * 15.0);
            }
            g *= 0.085;
            vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          }`
        );
    };
    const lg = new THREE.ShapeGeometry(rrShape(TRAY.w - 2 * TRAY.wall + 0.004, TRAY.d - 2 * TRAY.wall + 0.004, 0.023), 10);
    lg.rotateX(-Math.PI / 2);
    const liquid = new THREE.Mesh(lg, liquidMat);
    liquid.position.y = LIQ_Y;
    g.add(liquid);
    scene.add(g);
    const tray = {
      idx, group: g, spec, u: lu, liquid: liquidMat, liquidMesh: liquid,
      // rocking by hand: tilt about x and z, with its own spring
      rk: { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, held: false }
    };
    walls.userData = liquid.userData = { kind: "tray", tray };
    return tray;
  }
  const trays = TRAYS.map(makeTray);
  const devTray = trays[0], stopTray = trays[1], fixTray = trays[2];

  /* Tongs: rest across the stop tray; carry each print from tray to tray to the line */
  const tongs = new THREE.Group();
  {
    const bamboo = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x7a1d14, roughness: 0.7 });
    for (let i = 0; i < 2; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.014), bamboo);
      arm.position.set(0.12, 0.004 * i, i * 0.012 - 0.006);
      arm.rotation.y = (i ? 1 : -1) * 0.03;
      arm.castShadow = true;
      tongs.add(arm);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.016), rubber);
      tip.position.set(0.01, 0.004 * i, i * 0.012 - 0.006);
      tongs.add(tip);
    }
    scene.add(tongs);
  }
  const tongRest = { pos: V(0.45, TRAY.h + 0.012, 0.075), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.35, 0)) };
  const tongGrip = { pos: V(), quat: new THREE.Quaternion() };
  const tongDir = V(0.5, 0.78, -0.36).normalize();
  const tongQuat = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), tongDir);
  tongs.position.copy(tongRest.pos);
  tongs.quaternion.copy(tongRest.quat);

  /* ---------- Enlarger, easel, its timer, and the paper safe ---------- */
  const enlargerParts = [];
  const lensGlow = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.05, emissive: new THREE.Color(1, 0.78, 0.5), emissiveIntensity: 0 });
  {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.026, 0.46, 3, 0.006), new THREE.MeshStandardMaterial({ color: 0x232120, roughness: 0.6 }));
    base.position.set(ENL_X, 0.013, -0.1);
    base.castShadow = base.receiveShadow = true;
    scene.add(base);
    const easel = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.012, 0.3, 2, 0.004), new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.55 }));
    easel.position.set(EASEL.x, 0.032, EASEL.z);
    easel.castShadow = easel.receiveShadow = true;
    scene.add(easel);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x9da0a3, roughness: 0.35, metalness: 0.7 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.008, 0.024), bladeMat);
    b1.position.set(EASEL.x, 0.042, EASEL.z - 0.15);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.3), bladeMat);
    b2.position.set(EASEL.x - 0.18, 0.042, EASEL.z);
    [b1, b2].forEach((b) => { b.castShadow = true; scene.add(b); });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 24), metalMat);
    col.position.set(ENL_X, 0.64, -0.3);
    col.castShadow = true;
    scene.add(col);
    const head = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.16), blackMat);
    arm.position.set(0, 0, 0.08);
    const house = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.17, 0.22, 4, 0.02), blackMat);
    house.position.set(0, 0.04, 0.26);
    const bellows = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 24, 6, true), new THREE.MeshStandardMaterial({ color: 0x141212, roughness: 0.9, side: THREE.DoubleSide }));
    bellows.position.set(0, -0.09, 0.26);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.05, 24), metalMat);
    lens.position.set(0, -0.165, 0.26);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), lensGlow);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, -0.191, 0.26);
    head.add(arm, house, bellows, lens, glass);
    head.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    head.position.set(ENL_X, 0.86, -0.3);
    scene.add(head);
    [base, col, arm, house, bellows, lens].forEach((m) => { m.userData = { kind: "enlarger" }; enlargerParts.push(m); });
  }
  // The exposure timer beside the enlarger: a red seven-segment readout and a press button.
  const led = ledTexture();
  const expButton = new THREE.MeshStandardMaterial({ color: 0x8a1c10, roughness: 0.45, emissive: new THREE.Color(1, 0.16, 0.06), emissiveIntensity: 0.15 });
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.05, 0.1, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5, metalness: 0.3 }));
    body.position.y = 0.025;
    body.castShadow = body.receiveShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.084, 0.036), new THREE.MeshBasicMaterial({ map: led.tex, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(-0.022, 0.0505, 0.004);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.015, 0.012, 24), expButton);
    btn.position.set(0.048, 0.056, 0.004);
    g.add(body, screen, btn);
    g.position.set(-0.6, 0, 0.21);
    g.rotation.y = -0.3;
    scene.add(g);
    [body, screen, btn].forEach((m) => { m.userData = { kind: "enlarger" }; enlargerParts.push(m); });
  }
  // The paper safe: a light-tight box whose lid opens for each fresh sheet.
  const safeLid = new THREE.Group();
  {
    const safeMat = new THREE.MeshStandardMaterial({ color: 0x141313, roughness: 0.5, metalness: 0.15 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.06, 0.28, 2, 0.006), safeMat);
    body.position.y = 0.03;
    body.castShadow = body.receiveShadow = true;
    const lidM = new THREE.Mesh(new RoundedBoxGeometry(0.346, 0.012, 0.286, 2, 0.004), safeMat);
    lidM.position.set(0, 0, 0.143);
    lidM.castShadow = true;
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.05), new THREE.MeshStandardMaterial({ map: labelTexture("PAPER", -0.05), roughness: 0.85 }));
    tape.rotation.x = -Math.PI / 2;
    tape.position.set(0.04, 0.0065, 0.19);
    safeLid.add(lidM, tape);
    safeLid.position.set(0, 0.066, -0.143);
    g.add(body, safeLid);
    g.position.set(SAFE.x, 0, SAFE.z);
    g.rotation.y = 0.16;
    scene.add(g);
  }

  /* Chemistry bottles with masking-tape labels */
  {
    const prof = [
      [0, 0], [0.044, 0], [0.047, 0.006], [0.047, 0.15], [0.043, 0.175], [0.026, 0.2], [0.016, 0.212],
      [0.016, 0.232], [0, 0.232]
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const bg = new THREE.LatheGeometry(prof, 40);
    const capG = new THREE.CylinderGeometry(0.019, 0.019, 0.026, 24);
    const labels = [["DEV", -0.08], ["STOP", 0.05], ["FIX", -0.03]];
    [[0.72, -0.47], [0.85, -0.5], [0.98, -0.46]].forEach((p, i) => {
      const b = new THREE.Mesh(bg, glassMat);
      b.position.set(p[0], 0, p[1]);
      b.castShadow = b.receiveShadow = true;
      scene.add(b);
      const cap = new THREE.Mesh(capG, blackMat);
      cap.position.set(p[0], 0.24, p[1]);
      cap.castShadow = true;
      scene.add(cap);
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0475, 0.0475, 0.05, 32, 1, true, -0.65, 1.3), new THREE.MeshStandardMaterial({ map: labelTexture(labels[i][0], labels[i][1]), roughness: 0.8 }));
      lab.position.set(p[0], 0.085, p[1]);
      scene.add(lab);
    });
  }

  /* The safelight over the bench, hanging on its cord */
  const lampGroup = new THREE.Group();
  let lampCord = null;
  const filterMat = new THREE.MeshStandardMaterial({ color: 0x220302, emissive: new THREE.Color(1, 0.09, 0.03), emissiveIntensity: 4.2, roughness: 0.3 });
  {
    const housing = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.2, 0.1, 4, 0.016), new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.45, metalness: 0.6 }));
    const filter = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.15), filterMat);
    filter.position.z = 0.0505;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), metalMat);
    bracket.position.set(0, 0.06, -0.08);
    lampGroup.add(housing, filter, bracket);
    lampGroup.position.copy(LAMP);
    lampGroup.lookAt(0.05, 0, 0.1);
    scene.add(lampGroup);
    lampCord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([LAMP.clone().add(V(0, 0.08, -0.04)), LAMP.clone().add(V(0.01, 0.5, -0.05)), LAMP.clone().add(V(0.02, 1.4, -0.05))]), 20, 0.004, 6), blackMat);
    scene.add(lampCord);
  }

  /* Haze in the safelight's beam */
  const hazeU = { uColor: { value: new THREE.Color(1, 0.13, 0.05) }, uAmt: { value: 0.16 } };
  const hazeVert = `varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){
      vY = uv.y;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const hazeFrag = `uniform vec3 uColor; uniform float uAmt; varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
      float fall = pow(vY, 1.6);
      gl_FragColor = vec4(uColor * uAmt * edge * fall, 1.0);
    }`;
  {
    const h = 1.5;
    const cg = new THREE.CylinderGeometry(0.06, 0.62, h, 48, 1, true);
    cg.translate(0, -h / 2, 0);
    // Light adds up in any order, so one pass draws both faces of the beams (one shader, not two).
    const cm = new THREE.ShaderMaterial({
      uniforms: hazeU, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending,
      vertexShader: hazeVert, fragmentShader: hazeFrag
    });
    const cone = new THREE.Mesh(cg, cm);
    cone.position.copy(LAMP).add(V(0, -0.06, 0.03));
    const dir = V(0.05, 0, 0.1).sub(cone.position).normalize();
    cone.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
    cone.renderOrder = 2;
    scene.add(cone);
  }

  /* Lights */
  const spot = new THREE.SpotLight(0xff2a12, 3.6, 0, 0.78, 0.9, 2);
  spot.position.copy(LAMP).add(V(-0.01, -0.06, 0.03));
  spot.target.position.set(0.12, 0, 0.0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.01;
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = 4;
  scene.add(spot, spot.target);
  const lampFill = new THREE.PointLight(0xff2a12, 0.55, 2.4, 2);
  lampFill.position.copy(LAMP).add(V(0, 0.05, -0.08));
  scene.add(lampFill);
  // Spill from the safelight onto the line where the prints hang.
  const lineWash = new THREE.PointLight(0xff2a12, 0.75, 2.2, 2);
  lineWash.position.set(-0.25, 1.38, -0.22);
  scene.add(lineWash);
  const hemi = new THREE.HemisphereLight(0x3a0905, 0x050101, 0.22);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xf6f9ff, 0);
  sun.position.set(0.6, 3.2, 2.2);
  sun.target.position.set(0, 0.3, -0.3);
  sun.castShadow = false;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  sun.shadow.camera.left = -2.2;
  sun.shadow.camera.right = 2.2;
  sun.shadow.camera.top = 2;
  sun.shadow.camera.bottom = -1;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const litHemi = new THREE.HemisphereLight(0xe8edf2, 0x3d3833, 0);
  scene.add(litHemi);
  // The enlarger lamp: warm light through the negative, down onto the easel.
  const enlLight = new THREE.SpotLight(0xffc68a, 0, 1.6, 0.62, 0.65, 2);
  enlLight.position.copy(LENS);
  enlLight.target.position.copy(EASEL);
  scene.add(enlLight, enlLight.target);

  /* A darkroom timer with luminous hands: the one green thing in a red room */
  const timerHands = [];
  {
    const tg = new THREE.Group();
    const bodyM = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.07, 4, 0.02), new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.5, metalness: 0.3 }));
    bodyM.castShadow = true;
    const fc = makeCanvas(256, 256), fg = fc.getContext("2d");
    fg.fillStyle = "#0b0c0b";
    fg.fillRect(0, 0, 256, 256);
    fg.strokeStyle = "#7dff9a";
    fg.fillStyle = "#7dff9a";
    fg.lineWidth = 3;
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2, r0 = k % 5 ? 108 : 98;
      fg.beginPath();
      fg.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0);
      fg.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116);
      fg.stroke();
    }
    fg.font = '600 22px "Barlow Condensed", "Arial Narrow", sans-serif';
    fg.textAlign = "center";
    fg.textBaseline = "middle";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      fg.fillText(String(k * 5), 128 + Math.sin(a) * 80, 128 - Math.cos(a) * 80);
    }
    const faceTex = texFrom(fc, { srgb: true });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.082, 48), new THREE.MeshStandardMaterial({
      map: faceTex, emissiveMap: faceTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.3
    }));
    face.position.z = 0.0355;
    const glassC = new THREE.Mesh(new THREE.CircleGeometry(0.084, 48), clearMat(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.002, ior: 1.5 }), 0.1));
    glassC.position.z = 0.04;
    const handMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, emissive: 0x6dff8d, emissiveIntensity: 1.6 });
    [0.07, 0.05].forEach((len, k) => {
      const hg = new THREE.Group();
      const hand = new THREE.Mesh(new THREE.BoxGeometry(k ? 0.006 : 0.004, len, 0.002), handMat);
      hand.position.y = len / 2 - 0.008;
      hg.add(hand);
      hg.position.z = 0.038;
      tg.add(hg);
      timerHands.push(hg);
    });
    tg.add(bodyM, face, glassC);
    tg.position.set(-0.4, 0.1, -0.44);
    tg.rotation.set(-0.12, 0.38, 0);
    scene.add(tg);
  }

  /* The drying line over the bench, hung from the ceiling at both ends */
  let lineWire = null;
  const lineY = (x) => LINE.y - LINE.sag * (1 - Math.pow(x / LINE.x1, 2));
  {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = lerp(LINE.x0, LINE.x1, i / 24);
      pts.push(V(x, lineY(x), LINE_Z));
    }
    lineWire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0016, 6), metalMat);
    lineWire.castShadow = true;
    scene.add(lineWire);
    [LINE.x0, LINE.x1].forEach((x) => {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 2.4, 6), metalMat);
      cord.position.set(x, LINE.y + 1.2, LINE_Z);
      scene.add(cord);
    });
  }

  /* ---------- Prints made at the bench ---------- */
  const clipGeo = new THREE.BoxGeometry(0.01, 0.06, 0.006);
  const springGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.016, 8);
  function makeClip() {
    const c = new THREE.Group();
    const a = new THREE.Mesh(clipGeo, woodMat), b = new THREE.Mesh(clipGeo, woodMat), s = new THREE.Mesh(springGeo, metalMat);
    a.position.z = 0.0045;
    b.position.z = -0.0045;
    s.rotation.x = Math.PI / 2;
    s.position.y = 0.004;
    a.castShadow = b.castShadow = true;
    c.add(a, b, s);
    c.position.y = 0.012;
    return c;
  }
  const B = 0.016;
  function printSize(ar) {
    if (ar >= 0.36 / 0.275) { const pw = 0.36; return { pw, ph: (pw - 2 * B) / ar + 2 * B }; }
    const ph = 0.275;
    return { pw: (ph - 2 * B) * ar + 2 * B, ph };
  }
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const hallMats = [];
  const prints = photos.map((ph, i) => {
    const ar = ph.ar, { pw, ph: phh } = printSize(ar);
    const hang = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = -phh / 2;
    hang.add(body);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(pw, phh, 0.0012), paperMat);
    paper.castShadow = paper.receiveShadow = true;
    const dev = { uC: { value: 0.18 }, uB: { value: 3.2 }, uS: { value: 0 } };
    // The photograph's own pixels: never tone-mapped, so its colours stay true.
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.48, toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, dev);
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uC; uniform float uB; uniform float uS;
          vec3 devc(vec3 c) {
            vec3 s = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
            s = clamp(((s - 0.5) * uC + 0.5) * uB, 0.0, 1.0);
            float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
            s = mix(vec3(l), s, uS);
            return pow(s, vec3(2.2));
          }`
        )
        .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = devc(diffuseColor.rgb);")
        .replace(
          "#include <emissivemap_fragment>",
          `#ifdef USE_EMISSIVEMAP
            vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
            totalEmissiveRadiance *= devc(emissiveColor.rgb);
          #endif`
        );
    };
    const img = new THREE.Mesh(new THREE.PlaneGeometry(pw - 2 * B, phh - 2 * B), mat);
    img.position.z = 0.00075;
    img.userData = { kind: "print", index: i };
    body.add(paper, img);
    const clips = [makeClip(), makeClip()];
    clips[0].position.x = -pw * 0.32;
    clips[1].position.x = pw * 0.32;
    clips.forEach((c) => { c.visible = false; hang.add(c); });
    hang.visible = false;
    scene.add(hang);
    const p = {
      i, ar, pw, ph: phh, hang, img, mat, dev, clips, devK: 0, mAt: -1,
      waiters: [], pose: null, texThumb: null, texFull: null, wasHung: false,
      sw: { a: 0, v: 0, b: 0, w: 0 }
    };
    // In the drying room, the same photograph hangs again and again: true colour, dimmed by the dark.
    hallMats[i] = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.06, roughness: 0.5, toneMapped: false });
    hallMats[i].onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor;\n#endif");
    };
    loader.load(ph.thumb, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      p.texThumb = t;
      if (!p.texFull) setTex(p, t);
      hallMats[i].map = hallMats[i].emissiveMap = t;
      hallMats[i].needsUpdate = true;
      if (projected === i) setProjection(i);
      p.ready = true;
      p.waiters.splice(0).forEach((f) => f());
    });
    return p;
  });
  function setTex(p, t) {
    p.mat.map = t;
    p.mat.emissiveMap = t;
    p.mat.needsUpdate = true;
  }
  function useFull(p) {
    if (p.texFull || !photos[p.i].full) return;
    loader.load(photos[p.i].full, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      p.texFull = t;
      setTex(p, t);
    });
  }
  function dropFull(p) {
    if (!p.texFull) return;
    if (p.texThumb) setTex(p, p.texThumb);
    p.texFull.dispose();
    p.texFull = null;
  }
  // The image carries a little of its own colour once it has come up, so it
  // reads in the red light; blank paper never glows.
  let emiLevel = 0.68, photoDiffuse = 0.4, hallEmi = 0.06, hallDiffuse = 0.2;
  function applyDev(p) {
    const d = devAt(p.devK);
    p.dev.uC.value = d[0];
    p.dev.uB.value = d[1];
    p.dev.uS.value = d[2];
    p.mat.emissiveIntensity = emiLevel * smooth(clamp((p.devK - 0.35) / 0.65, 0, 1));
    p.mat.color.setScalar(photoDiffuse);
  }
  prints.forEach(applyDev);
  function whenReady(p) {
    return new Promise((res) => { if (p.ready) res(); else p.waiters.push(res); });
  }

  /* ---------- The enlarger at work: the beam, the negative on the easel, dust in the light ---------- */
  let projected = -1;
  const projU = { uMap: { value: null }, uAmt: { value: 0 } };
  const projMat = new THREE.ShaderMaterial({
    uniforms: projU, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    // A colour negative: tones reversed, seen through the film's orange base.
    fragmentShader: `uniform sampler2D uMap; uniform float uAmt; varying vec2 vUv;
      void main(){
        vec3 c = pow(max(texture2D(uMap, vUv).rgb, vec3(0.0)), vec3(1.0 / 2.2));
        vec3 neg = (vec3(1.0) - c) * vec3(1.0, 0.66, 0.42) + vec3(0.05, 0.025, 0.01);
        // the lamp outshines the safelight on the easel: the negative covers the paper as it comes on
        gl_FragColor = vec4(pow(neg, vec3(2.2)) * 1.25, uAmt);
      }`
  });
  const projPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), projMat);
  projPlane.visible = false;
  projPlane.renderOrder = 3;
  scene.add(projPlane);
  const beamU = { uColor: { value: new THREE.Color(1, 0.8, 0.55) }, uAmt: { value: 0 } };
  const beam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    uniforms: beamU, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending,
    vertexShader: `varying float vY; varying float vX; varying vec3 vN; varying vec3 vV;
      void main(){
        vY = uv.y;
        vX = uv.x;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying float vY; varying float vX; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float across = sin(3.14159 * clamp(vX, 0.0, 1.0));
        gl_FragColor = vec4(uColor * uAmt * edge * across * (0.5 + 0.5 * (1.0 - vY)), 1.0);
      }`
  }));
  beam.visible = false;
  beam.renderOrder = 2;
  scene.add(beam);
  const DUST = 140;
  const dustSeed = new Float32Array(DUST * 3);
  {
    const r = rng(5);
    for (let k = 0; k < DUST * 3; k++) dustSeed[k] = r();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  const dustU = { uAmt: { value: 0 }, uScale: { value: 300 } };
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = fract(position.x * 91.7 + position.z * 37.3);
        gl_PointSize = uScale * (0.0012 + 0.0012 * vA) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uAmt; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard;
        gl_FragColor = vec4(vec3(1.0, 0.85, 0.62) * uAmt * (0.4 + 0.6 * vA) * (1.0 - r * 4.0), 1.0); }`
  }));
  dust.visible = false;
  dust.frustumCulled = false;
  scene.add(dust);
  // The rectangle the enlarger lights: the print's image area on the easel.
  const projCorners = [V(), V(), V(), V()];
  function setProjection(i) {
    projected = i;
    const p = prints[i];
    if (!p) return;
    projU.uMap.value = p.texThumb;
    const w = p.pw - 2 * B, h = p.ph - 2 * B, rz = 0.03;
    const y = 0.0436, c = Math.cos(rz), s = Math.sin(rz);
    projPlane.scale.set(w, h, 1);
    projPlane.position.set(EASEL.x, y, EASEL.z);
    projPlane.rotation.set(-Math.PI / 2, 0, rz);
    // the beam: from the lens down to the four corners of the image
    [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach((q, k) => {
      const lx = (q[0] * w) / 2, ly = (q[1] * h) / 2;
      // local (lx, ly) in the plane, laid flat: x stays, y becomes -z
      projCorners[k].set(EASEL.x + c * lx - s * ly, y, EASEL.z - (s * lx + c * ly));
    });
    const pos = [], uv = [];
    const top = projCorners.map((pc) => LENS.clone().lerp(pc, 0.04));
    for (let k = 0; k < 4; k++) {
      const a = top[k], b = top[(k + 1) % 4], cc = projCorners[(k + 1) % 4], d = projCorners[k];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z, a.x, a.y, a.z, cc.x, cc.y, cc.z, d.x, d.y, d.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }
    beam.geometry.dispose();
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    bg.computeVertexNormals();
    beam.geometry = bg;
  }
  function placeDust(sec) {
    const arr = dustGeo.attributes.position.array;
    for (let k = 0; k < DUST; k++) {
      const u = dustSeed[k * 3], v = dustSeed[k * 3 + 1], w = dustSeed[k * 3 + 2];
      // drifting slowly down through the light, wrapping round
      const t = mod(w - sec * (0.02 + 0.03 * u), 1);
      const c0 = projCorners[0], c1 = projCorners[1], c3 = projCorners[3];
      const bx = c0.x + (c1.x - c0.x) * u + (c3.x - c0.x) * v, bz = c0.z + (c1.z - c0.z) * u + (c3.z - c0.z) * v;
      const k2 = 0.08 + 0.9 * t;
      arr[k * 3] = lerp(LENS.x, bx, k2) + Math.sin(sec * 0.7 + k) * 0.003;
      arr[k * 3 + 1] = lerp(LENS.y, 0.05, k2);
      arr[k * 3 + 2] = lerp(LENS.z, bz, k2);
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- The drying room: rows of lines behind the bench, without end ---------- */
  const hall = (() => {
    const per = HALL.per, rows = HALL.rows, slots = [], count = photos.map(() => 0);
    const lines = [];
    for (let r = 0; r < rows; r++) {
      // every photograph in a different order on each line, never the same one twice in a row
      const rr = rng(101 + r * 7), seq = [];
      while (seq.length < per) {
        const batch = photos.map((_, n) => n);
        for (let k = batch.length - 1; k > 0; k--) { const j = Math.floor(rr() * (k + 1)); [batch[k], batch[j]] = [batch[j], batch[k]]; }
        if (seq.length && N > 1 && batch[0] === seq[seq.length - 1]) batch.push(batch.shift());
        seq.push(...batch);
      }
      seq.length = per;
      let x = 0;
      const line = { r, slots: [], period: 0, shift: rr() * 3 };
      seq.forEach((photo, j) => {
        const { pw, ph } = printSize(photos[photo].ar);
        const gap = 0.15 + rr() * 0.08;
        const s = { r, j, photo, pw, ph, x: x + pw / 2, inst: count[photo]++, phase: rr() * 6.28, a: 0, v: 0, sx: 0, z: 0 };
        x += pw + gap;
        slots.push(s);
        line.slots.push(s);
      });
      line.period = x;
      lines.push(line);
    }
    const plane = new THREE.PlaneGeometry(1, 1);
    const imgs = photos.map((_, i) => {
      const m = new THREE.InstancedMesh(plane, hallMats[i], Math.max(1, count[i]));
      m.count = count[i];
      m.frustumCulled = false;
      m.userData = { kind: "hall", photo: i };
      scene.add(m);
      return m;
    });
    const papers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.0012), new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.62 }), slots.length);
    const woods = new THREE.InstancedMesh(clipGeo, woodMat, slots.length * 4);
    const wires = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0016, 0.0016, 40, 6), metalMat, rows);
    // a safelight over every other line, a fluorescent fitting over every line
    const LAMPS = 6, lampRows = Math.ceil(rows / 2);
    const lampHousings = new THREE.InstancedMesh(new RoundedBoxGeometry(0.22, 0.15, 0.09, 2, 0.014), new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.45, metalness: 0.6 }), lampRows * LAMPS);
    const lampFilters = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 0.11), filterMat, lampRows * LAMPS);
    const lampCords = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.003, 0.003, 2.2, 5), blackMat, lampRows * LAMPS);
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.62, 1.7, 20, 1, true);
    beamGeo.translate(0, -0.85, 0);
    const hallBeamU = { uColor: { value: new THREE.Color(1, 0.13, 0.05) }, uAmt: { value: 0.11 }, uFogNear: { value: 2 }, uFogFar: { value: 9 } };
    const hallBeams = new THREE.InstancedMesh(beamGeo, new THREE.ShaderMaterial({
      uniforms: hallBeamU, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uFogNear; uniform float uFogFar; varying float vY; varying vec3 vN; varying vec3 vV; varying float vFog;
        void main(){
          vY = uv.y;
          mat4 m = modelMatrix;
          #ifdef USE_INSTANCING
            m = m * instanceMatrix;
          #endif
          vec4 wp = m * vec4(position, 1.0);
          vN = normalize(mat3(m) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          vec4 mv = viewMatrix * wp;
          vFog = 1.0 - smoothstep(uFogNear, uFogFar, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying float vY; varying vec3 vN; varying vec3 vV; varying float vFog;
        void main(){
          float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
          gl_FragColor = vec4(uColor * uAmt * edge * pow(vY, 1.5) * vFog, 1.0);
        }`
    }), Math.ceil(rows / 2) * 6);
    hallBeams.renderOrder = 2;
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xff2410, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.2, 2.2), poolMat, lampRows * LAMPS);
    const TUBES = 6;
    const tubeHousings = new THREE.InstancedMesh(new THREE.BoxGeometry(1.26, 0.045, 0.13), new THREE.MeshStandardMaterial({ color: 0x4a4b48, roughness: 0.55, metalness: 0.5 }), rows * TUBES);
    const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.45), toneMapped: false });
    const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 1.18, 10), tubeMat, rows * TUBES * 2);
    const tubeOn = new Float32Array(rows);
    [papers, woods, wires, lampHousings, lampFilters, lampCords, pools, tubeHousings, tubes, hallBeams].forEach((m) => { m.frustumCulled = false; scene.add(m); });
    const black = new THREE.Color(0.05, 0.05, 0.05);
    for (let k = 0; k < tubes.count; k++) tubes.setColorAt(k, black);
    for (let k = 0; k < papers.count; k++) papers.setColorAt(k, black);
    imgs.forEach((m) => { for (let k = 0; k < m.count; k++) m.setColorAt(k, black); });
    let litMix = 0;
    // How much of a nearby safelight reaches a print: a pool under each lamp, a little spill onto the next line back.
    function lampLight(x, r) {
      const bay = HALL.bay;
      const near = (rl, w) => {
        const off = rl % 4 ? 1.4 : 0, dx = mod(x - off + bay / 2, bay) - bay / 2;
        return w * Math.exp(-(dx * dx) / 0.62);
      };
      const b = r % 2 === 0 ? near(r, 1) : near(r - 1, 0.55);
      return 0.16 + 0.84 * Math.min(1, b);
    }
    const dummy = new THREE.Object3D();
    const rowZ = new Float32Array(rows);
    const col = new THREE.Color();
    let lastSec = 0;
    function place(camX, camZ, sec, still) {
      // which depth each line sits at: the window starts just behind the camera, never in front of the bench
      const dCam = HALL.z0 - camZ, start = Math.max(0, Math.floor((dCam - 0.6) / HALL.gap));
      for (let r = 0; r < rows; r++) {
        const a = r + rows * Math.ceil((start - r) / rows);
        rowZ[r] = HALL.z0 - a * HALL.gap;
      }
      const dts = Math.min(0.05, Math.max(0, sec - lastSec));
      lastSec = sec;
      const pa = papers.instanceMatrix.array, wa = woods.instanceMatrix.array;
      lines.forEach((line) => {
        const z = rowZ[line.r], P = line.period;
        line.slots.forEach((s, n) => {
          // wrapped around the camera so the line never ends
          const x = mod(s.x + line.shift - (camX - P / 2), P) + camX - P / 2;
          if (!still) {
            s.v += (-36 * s.a - 1.1 * s.v) * dts;
            s.a += s.v * dts;
          }
          const ang = s.a + (still ? 0 : 0.012 * Math.sin(sec * 0.7 + s.phase));
          const c = Math.cos(ang), sn = Math.sin(ang), y = HALL.y;
          s.sx = x;
          s.z = z;
          const iw = s.pw - 2 * B, ih = s.ph - 2 * B;
          writeTRS(imgs[s.photo].instanceMatrix.array, s.inst, x, y, z, c, sn, 0, -s.ph / 2, 0.0008, iw, ih, 1);
          const idx = line.r * per + n;
          col.setScalar(lerp(lampLight(x, line.r), 1, litMix));
          imgs[s.photo].setColorAt(s.inst, col);
          papers.setColorAt(idx, col);
          writeTRS(pa, idx, x, y, z, c, sn, 0, -s.ph / 2, 0, s.pw, s.ph, 1);
          const cx = s.pw * 0.32;
          writeTRS(wa, idx * 4, x, y, z, c, sn, -cx, 0.012, 0.0045, 1, 1, 1);
          writeTRS(wa, idx * 4 + 1, x, y, z, c, sn, -cx, 0.012, -0.0045, 1, 1, 1);
          writeTRS(wa, idx * 4 + 2, x, y, z, c, sn, cx, 0.012, 0.0045, 1, 1, 1);
          writeTRS(wa, idx * 4 + 3, x, y, z, c, sn, cx, 0.012, -0.0045, 1, 1, 1);
        });
        dummy.position.set(camX, HALL.y + 0.001, z);
        dummy.rotation.set(0, 0, Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        wires.setMatrixAt(line.r, dummy.matrix);
      });
      // lamps and tubes, wrapped along x in bays
      const bay = HALL.bay;
      let li = 0, ti = 0;
      for (let r = 0; r < rows; r++) {
        const z = rowZ[r];
        const base = Math.floor(camX / bay) - Math.floor(TUBES / 2);
        for (let j = 0; j < TUBES; j++) {
          const x = (base + j) * bay + 0.7 + (r % 2) * 1.4;
          dummy.rotation.set(0, 0, 0);
          dummy.position.set(x, HALL.tubeY, z - 0.12);
          dummy.updateMatrix();
          tubeHousings.setMatrixAt(r * TUBES + j, dummy.matrix);
          dummy.rotation.set(0, 0, Math.PI / 2);
          for (let k = 0; k < 2; k++) {
            dummy.position.set(x, HALL.tubeY - 0.03, z - 0.12 + (k ? 0.035 : -0.035));
            dummy.updateMatrix();
            tubes.setMatrixAt(ti, dummy.matrix);
            col.setScalar(0.05 + 0.95 * tubeOn[r]);
            tubes.setColorAt(ti, col);
            ti++;
          }
        }
        if (r % 2 === 0) {
          for (let j = 0; j < LAMPS; j++) {
            const x = (base + j) * bay + (r % 4 ? 1.4 : 0);
            dummy.rotation.set(-1.25, 0, 0);
            dummy.position.set(x, HALL.lampY, z + 0.2);
            dummy.updateMatrix();
            lampHousings.setMatrixAt(li, dummy.matrix);
            dummy.position.set(x, HALL.lampY - 0.0429, z + 0.2 + 0.0145);
            dummy.updateMatrix();
            lampFilters.setMatrixAt(li, dummy.matrix);
            dummy.rotation.set(0.22, 0, 0);
            dummy.position.set(x, HALL.lampY - 0.07, z + 0.22);
            dummy.updateMatrix();
            hallBeams.setMatrixAt(li, dummy.matrix);
            dummy.rotation.set(0, 0, 0);
            dummy.position.set(x, HALL.lampY + 1.18, z + 0.18);
            dummy.updateMatrix();
            lampCords.setMatrixAt(li, dummy.matrix);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.position.set(x, FLOOR_Y + 0.004 + li * 0.0004, z + 0.75);
            dummy.updateMatrix();
            pools.setMatrixAt(li, dummy.matrix);
            li++;
          }
        }
      }
      imgs.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      [papers, woods, wires, lampHousings, lampFilters, lampCords, pools, tubeHousings, tubes, hallBeams].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      [tubes, papers].concat(imgs).forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    }
    function setMix(m, fogNear, fogFar) {
      litMix = m;
      hallBeamU.uAmt.value = 0.11 * (1 - m);
      hallBeamU.uFogNear.value = fogNear;
      hallBeamU.uFogFar.value = fogFar;
      hallBeams.visible = m < 0.99;
    }
    // Where a hanging copy shows on screen, for the close-up to lift it from.
    function rectOf(s) {
      const r = canvas.getBoundingClientRect(), iw = s.pw - 2 * B, ih = s.ph - 2 * B;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const c = Math.cos(s.a), sn = Math.sin(s.a);
      [[-iw / 2, -B], [iw / 2, -B], [-iw / 2, -B - ih], [iw / 2, -B - ih]].forEach((q) => {
        const v = V(s.sx + c * q[0] - sn * q[1], HALL.y + sn * q[0] + c * q[1], s.z + 0.0008).project(camera);
        const x = r.left + (v.x * 0.5 + 0.5) * r.width, y = r.top + (-v.y * 0.5 + 0.5) * r.height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      });
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    }
    function slotOf(photo, inst) {
      return slots.find((s) => s.photo === photo && s.inst === inst) || null;
    }
    return { imgs, place, rectOf, slotOf, tubeOn, rowZ, poolMat, rows, setMix };
  })();

  /* Reflections: the room itself, seen from the developer's surface. */
  function captureEnv() {
    devTray.group.visible = false;
    scene.position.y = -LIQ_Y - 0.004;
    scene.updateMatrixWorld(true);
    const rt = pmrem.fromScene(scene, 0, 0.03, 14);
    scene.position.y = 0;
    scene.updateMatrixWorld(true);
    devTray.group.visible = true;
    return rt.texture;
  }
  hall.place(0.3, 2, 0, true);
  safeEnv = captureEnv();
  scene.environment = safeEnv;

  /* ---------- Poses: where a print can be, and how it is held ---------- */
  const slots = [];
  function layoutLine() {
    const gap = 0.07, avail = LINE.x1 - LINE.x0 - 0.3;
    const need = prints.reduce((s, p) => s + p.pw + gap, -gap);
    const f = Math.min(1, avail / need);
    let x = -(need * f) / 2;
    slots.length = 0;
    prints.forEach((p) => {
      const cx = x + (p.pw * f) / 2;
      slots.push({ x: cx, s: f });
      x += (p.pw + gap) * f;
    });
  }
  layoutLine();
  const pose = {
    safe: (p) => ({ pos: V(SAFE.x + 0.01, 0.03, SAFE.z - p.ph / 2 + 0.02), rx: -Math.PI / 2, rz: 0.16, s: 1 }),
    easel: (p) => ({ pos: V(EASEL.x, 0.041, EASEL.z - p.ph / 2), rx: -Math.PI / 2, rz: 0.03, s: 1 }),
    tray: (p, t) => ({ pos: V(t.spec.x + 0.004, PRINT_Y, t.spec.z - p.ph / 2 + 0.006), rx: -Math.PI / 2, rz: t === devTray ? -0.035 : 0.025 * (t.idx === 1 ? 1 : -1), s: 1 }),
    line: (p) => {
      const sl = slots[p.i];
      return { pos: V(sl.x, lineY(sl.x) - 0.002, LINE_Z + 0.004), rx: 0, rz: 0, s: sl.s };
    }
  };
  function setPose(p, q) {
    p.pose = q;
    p.hang.position.copy(q.pos);
    p.hang.rotation.set(q.rx, 0, q.rz);
    p.hang.scale.setScalar(q.s);
    p.clips.forEach((c) => c.scale.setScalar(1 / q.s));
  }
  /* Move along a lifted arc between two poses. */
  function blendPose(a, b, k, lift) {
    const pos = a.pos.clone().lerp(b.pos, k);
    pos.y += Math.sin(Math.PI * k) * lift;
    return { pos, rx: lerp(a.rx, b.rx, k), rz: lerp(a.rz, b.rz, k) + Math.sin(Math.PI * k) * 0.12, s: lerp(a.s, b.s, k) };
  }
  /* Out of one tray by the top edge, hanging from the tongs, and down into the next. */
  function carry(a, b, k) {
    const mid = { pos: a.pos.clone().lerp(b.pos, 0.5).add(V(0, 0.26, 0.03)), rx: -0.32, rz: lerp(a.rz, b.rz, 0.5), s: 1 };
    if (k < 0.5) return blendPose(a, mid, E.inOut(k * 2), 0);
    return blendPose(mid, b, E.inOut((k - 0.5) * 2), 0);
  }
  const aboveOf = (q) => ({ pos: q.pos.clone().add(V(0, 0.07, 0)), rx: q.rx + 0.08, rz: q.rz, s: 1 });

  /* ---------- Camera ---------- */
  const view = { pos: V(0.4, 1.1, 2.4), look: V(0, 0.5, -0.3) };
  let aspect = 1, fov = 36;
  function fitDist(w, h) {
    const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    return Math.max(h / 2 / Math.tan(vf / 2), w / 2 / Math.tan(hf / 2));
  }
  // Camera framings: a point to look at, and where the camera sits relative to it.
  const frame0 = (look, off) => ({ look, off });
  const asView = (f) => ({ pos: f.look.clone().add(f.off), look: f.look });
  function trayFrame(t) {
    const portrait = aspect < 0.85;
    const el = THREE.MathUtils.degToRad(portrait ? 66 : 61);
    const look = V(t.spec.x, 0.02, t.spec.z + (portrait ? 0.0 : 0.01));
    const d = fitDist(portrait ? 0.48 : 0.7, portrait ? 0.36 : 0.44);
    return frame0(look, V(portrait ? 0 : 0.03, Math.sin(el) * d, Math.cos(el) * d));
  }
  function lineFrame(i) {
    const sl = slots[i], p = prints[i];
    const look = V(sl.x * 0.9, lineY(sl.x) - p.ph * sl.s * 0.45, LINE_Z);
    const d = fitDist(aspect < 0.85 ? 0.62 : 1.05, 0.62);
    return frame0(look, V(-sl.x * 0.12, -0.12, d));
  }
  // The enlarger from the front, lens to easel; it closes in a little while the lamp is on.
  function enlargerFrame(push) {
    const portrait = aspect < 0.85;
    const look = V(ENL_X + 0.03, portrait ? 0.36 : 0.38, -0.06);
    const el = THREE.MathUtils.degToRad(portrait ? 28 : 22);
    const d = fitDist(portrait ? 0.56 : 0.9, portrait ? 1.08 : 1.0) * (1 - 0.07 * (push || 0));
    return frame0(look, V(0.12, Math.sin(el) * d, Math.cos(el) * d));
  }
  // Down the room over the bench: the trays in front, the lines and their lamps going on into the dark.
  function roomFrame() {
    const portrait = aspect < 0.85;
    const look = portrait ? V(-0.15, 0.45, -1.6) : V(-0.1, 0.5, -1.6);
    return frame0(look, (portrait ? V(0.05, 1.62, 3.3) : V(0.3, 1.45, 2.9)).sub(look));
  }
  // Between two framings the camera keeps whatever is moving in view.
  function between(a, b, k, subject) {
    const kk = clamp(k, 0, 1), e = E.inOut(kk);
    const look = a.look.clone().lerp(b.look, e);
    if (subject) look.lerp(subject, Math.sqrt(Math.sin(Math.PI * kk)));
    return frame0(look, a.off.clone().lerp(b.off, e));
  }
  // The middle of a print held in pose q.
  const tmpEuler = new THREE.Euler();
  function centerOf(q, p) {
    tmpEuler.set(q.rx, 0, q.rz);
    return V(0, (-p.ph / 2) * q.s, 0).applyEuler(tmpEuler).add(q.pos);
  }
  // Wandering the lit drying room: along the lines (x) and between them (depth).
  const travel = { x: 0, d: 0, vx: 0, vd: 0, ax: 0, ad: 0 };
  function hallView() {
    const portrait = aspect < 0.85;
    const d = travel.ad + pos * HALL.gap * 0.85;
    const p = V(0.22 + travel.ax, portrait ? 1.5 : 1.62, (portrait ? 2.3 : 2.2) - d);
    return { pos: p, look: p.clone().add(V(0, portrait ? -0.4 : -0.62, -3)) };
  }
  const pointer = { x: 0, y: 0 };

  /* ---------- Post-processing ---------- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: coarse ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.045 }, uVig: { value: 0.42 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float n = h(floor(vUv * vec2(1600.0, 1000.0)) + fract(uTime * 7.0) * 91.0) - 0.5;
        c.rgb += n * uGrain;
        vec2 d = vUv - 0.5;
        float v = 1.0 - smoothstep(0.22, 0.82, length(d * vec2(1.05, 1.15)));
        c.rgb *= mix(1.0 - uVig, 1.0, v);
        gl_FragColor = c;
      }`
  });
  composer.addPass(grain);

  /* ---------- Sizing ---------- */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    aspect = w / h;
    fov = aspect < 0.85 ? 46 : 34;
    camera.aspect = aspect;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    dustU.uScale.value = h * renderer.getPixelRatio();
  }

  function splash(tray, x, z) {
    tray.u.uDrop.value.set(x - tray.spec.x, z - tray.spec.z, U.time.value);
  }
  function setHands(sec) {
    timerHands[0].rotation.z = -(sec / 60) * Math.PI * 2;
    timerHands[1].rotation.z = -(sec / 3600) * Math.PI * 2 - 0.5;
  }

  /* ---------- The darkroom follows the scroll ----------
     The page gives a position from 0 to N - 1. Between print i and print i + 1
     one scroll step plays the whole hand-off, and every part of it follows the
     scroll in both directions: print i goes from the developer through the stop
     bath and the fixer to the line (the camera follows it along the bench and
     up), the next sheet comes out of the paper safe onto the easel, is exposed
     under the enlarger, and is slid into the developer, where it comes up.
     A whole number is a finished print in the developer. */
  const PH = {
    grip: 0.03, stopIn: 0.085, stopOut: 0.115, fixIn: 0.17, fixOut: 0.2, hang: 0.33, letGo: 0.37,
    take0: 0.37, take1: 0.42, exp0: 0.45, exp1: 0.57, slide0: 0.59, drop0: 0.64, drop1: 0.675, dev0: 0.69, dev1: 0.97
  };
  // The opening (q from 0 to 1): the room, then the first sheet is exposed and developed.
  const IN = { take0: 0.1, take1: 0.2, exp0: 0.28, exp1: 0.44, slide0: 0.47, drop0: 0.54, drop1: 0.58, dev0: 0.6, dev1: 0.97 };
  const INTRO_MS = 8200;
  let target = 0, pos = 0, intro = reduce ? 1 : 0, introStart = -1;
  // The pace a print goes through the process when the page runs ahead of the scene:
  // prints per second, so about five seconds a print.
  const PLAY = 0.2;
  let posV = 0;
  let lightsOn = false, lightE = 0, lightM = 0, appliedM = -1, flickerUntil = 0, lightWaiters = [], litAt = -1e9;
  let shown = -1, hudKey = "";
  let prevI = 0, prevF = 0, prevQ = 0;
  function mixView(a, b, k) {
    return { pos: a.pos.clone().lerp(b.pos, k), look: a.look.clone().lerp(b.look, k) };
  }
  function split(pp) {
    const i = Math.min(N - 1, Math.floor(pp));
    return { i, f: i >= N - 1 ? 0 : pp - i };
  }
  // The sheet's way from the paper safe to the developer, on a 0 to 1 clock ph.
  function sheetState(pr, t, P) {
    const tDev = pose.tray(pr, devTray), easel = pose.easel(pr);
    if (t < P.take0) return { pose: pose.safe(pr), dev: 0, vis: false };
    if (t < P.take1) return { pose: blendPose(pose.safe(pr), easel, E.inOut(seg(t, P.take0, P.take1)), 0.1), dev: 0, vis: true };
    if (t < P.slide0) return { pose: easel, dev: 0, vis: true, easel: true };
    if (t < P.drop0) return { pose: blendPose(easel, aboveOf(tDev), E.inOut(seg(t, P.slide0, P.drop0)), 0.08), dev: 0, vis: true };
    if (t < P.drop1) return { pose: blendPose(aboveOf(tDev), tDev, E.in(seg(t, P.drop0, P.drop1)), 0), dev: 0, vis: true };
    return { pose: tDev, dev: smooth(seg(t, P.dev0, P.dev1)), vis: true, tray: devTray };
  }
  // Where print k is at this point on the path, how far it has developed, and what holds it.
  function pathState(k, pp, q) {
    const pr = prints[k], { i, f } = split(pp);
    if (k < i) return { pose: pose.line(pr), dev: 1, vis: true, hung: true };
    if (k === i) {
      if (k === 0 && q < 1) return sheetState(pr, q, IN);
      const tDev = pose.tray(pr, devTray), tStop = pose.tray(pr, stopTray), tFix = pose.tray(pr, fixTray), line = pose.line(pr);
      if (f <= PH.grip) return { pose: tDev, dev: 1, vis: true, tray: devTray };
      if (f <= PH.stopIn) return { pose: carry(tDev, tStop, seg(f, PH.grip, PH.stopIn)), dev: 1, vis: true, held: true };
      if (f <= PH.stopOut) return { pose: tStop, dev: 1, vis: true, tray: stopTray, held: true };
      if (f <= PH.fixIn) return { pose: carry(tStop, tFix, seg(f, PH.stopOut, PH.fixIn)), dev: 1, vis: true, held: true };
      if (f <= PH.fixOut) return { pose: tFix, dev: 1, vis: true, tray: fixTray, held: true };
      if (f <= PH.hang) {
        const k2 = seg(f, PH.fixOut, PH.hang);
        const lifted = { pos: tFix.pos.clone().add(V(0, 0.3, 0.02)), rx: -0.3, rz: tFix.rz, s: 1 };
        return { pose: k2 < 0.3 ? blendPose(tFix, lifted, E.inOut(k2 / 0.3), 0) : blendPose(lifted, line, E.inOut((k2 - 0.3) / 0.7), 0.1), dev: 1, vis: true, held: true };
      }
      return { pose: line, dev: 1, vis: true, hung: true };
    }
    if (k === i + 1) return sheetState(pr, f, PH);
    return { pose: pose.safe(pr), dev: 0, vis: false };
  }
  // How hard the enlarger lamp is burning along the path, and on which print.
  function pathLamp(pp, q) {
    const { i, f } = split(pp);
    if (q < 1 && pp < 0.02) return { amt: lampRamp(q, IN.exp0, IN.exp1, 0.012), k: 0, t: seg(q, IN.exp0, IN.exp1) };
    if (i + 1 < N) return { amt: lampRamp(f, PH.exp0, PH.exp1, 0.006), k: i + 1, t: seg(f, PH.exp0, PH.exp1) };
    return { amt: 0, k: -1, t: 0 };
  }
  function lampRamp(t, a, b, r) { return t < a || t > b ? 0 : Math.min(1, (t - a) / r, (b - t) / r); }
  // The camera on the same path: along the bench with the print, up to the line, to the enlarger, back.
  function pathCam(pp, q) {
    const T = trayFrame(devTray);
    if (q < 1 && pp < 0.02) {
      const sub = centerOf(sheetState(prints[0], q, IN).pose, prints[0]);
      if (q < IN.exp0) return asView(between(roomFrame(), enlargerFrame(0), seg(q, 0.05, IN.exp0 - 0.02), sub));
      if (q < IN.exp1) return asView(enlargerFrame(E.inOut(seg(q, IN.exp0, IN.exp1))));
      return asView(between(enlargerFrame(1), T, seg(q, IN.exp1 + 0.02, IN.drop1), sub));
    }
    const { i, f } = split(pp);
    if (i >= N - 1) return asView(T);
    const mine = () => centerOf(pathState(i, pp, 1).pose, prints[i]);
    const next = () => centerOf(pathState(i + 1, pp, 1).pose, prints[i + 1]);
    if (f < PH.stopIn) return asView(between(T, trayFrame(stopTray), seg(f, PH.grip, PH.stopIn), mine()));
    if (f < PH.fixIn) return asView(between(trayFrame(stopTray), trayFrame(fixTray), seg(f, PH.stopOut, PH.fixIn), mine()));
    if (f < PH.letGo) return asView(between(trayFrame(fixTray), lineFrame(i), seg(f, PH.fixOut, PH.hang - 0.02), mine()));
    if (f < PH.exp0) return asView(between(lineFrame(i), enlargerFrame(0), seg(f, PH.letGo - 0.01, PH.exp0 - 0.01), next()));
    if (f < PH.exp1) return asView(enlargerFrame(E.inOut(seg(f, PH.exp0, PH.exp1))));
    return asView(between(enlargerFrame(1), T, seg(f, PH.exp1 + 0.01, PH.drop1), next()));
  }
  // The tongs: they come to the print in the developer and let go of it on the line.
  function tongPath(pp) {
    const { i, f } = split(pp);
    if (i >= N - 1 || f <= 0) return 0;
    if (f < PH.grip) return smooth(f / PH.grip);
    if (f < PH.hang) return 1;
    return 1 - smooth(seg(f, PH.hang, PH.letGo));
  }
  // The paper safe's lid opens while a sheet is taken out.
  function lidPath(pp, q) {
    const P = q < 1 && pp < 0.02 ? IN : PH, t = q < 1 && pp < 0.02 ? q : split(pp).f;
    if (P === PH && split(pp).i + 1 >= N) return 0;
    return smooth(seg(t, P.take0 - 0.03, P.take0 + 0.005)) * (1 - smooth(seg(t, P.take1 - 0.01, P.take1 + 0.025)));
  }

  /* ---------- Lights: safelight, or the fluorescent tubes ---------- */
  // Effects the GPU check below may have to give up: shadows, reflections, post-processing.
  let noShadows = false, noEnv = false, direct = false;
  function setLightMix(m) {
    // m = 0 safelight, 1 white light
    spot.intensity = 3.6 * (1 - m);
    lampFill.intensity = 0.55 * (1 - m);
    lineWash.intensity = 0.75 * (1 - m);
    hemi.intensity = 0.22 * (1 - m);
    // Under white light the print shows exactly its own pixels.
    emiLevel = lerp(0.68, 1, m);
    photoDiffuse = lerp(0.4, 0, m);
    hallEmi = lerp(0.06, 1, m);
    hallDiffuse = lerp(0.2, 0, m);
    hallMats.forEach((hm) => { hm.emissiveIntensity = hallEmi; hm.color.setScalar(hallDiffuse); });
    filterMat.emissiveIntensity = lerp(4.2, 0.25, m);
    hall.poolMat.opacity = 0.5 * (1 - m);
    hazeU.uAmt.value = 0.16 * (1 - m);
    sun.intensity = 2.6 * m;
    litHemi.intensity = 1.25 * m;
    // Only the light that is on casts shadows (one shadow map per frame).
    sun.castShadow = !noShadows && m > 0.5;
    spot.castShadow = !noShadows && m <= 0.5;
    // The bench safelight is put away under the tubes, out of the way of the room.
    lampGroup.visible = lampCord.visible = m <= 0.5;
    scene.background.copy(SAFE_BG).lerp(LIT_BG, m);
    scene.fog.color.copy(SAFE_BG).lerp(LIT_BG, m);
    bloom.strength = lerp(0.55, 0.12, m);
    grain.uniforms.uVig.value = lerp(0.42, 0.08, m);
    grain.uniforms.uGrain.value = lerp(0.045, 0.012, m);
    // The lit room's reflections are captured once, the first time the lights are fully up.
    if (m >= 0.999 && !litEnv && !noEnv) litEnv = captureEnv();
    scene.environment = noEnv ? null : m > 0.5 && litEnv ? litEnv : safeEnv;
  }
  function setLights(on) {
    if (on !== lightsOn) {
      lightsOn = on;
      if (on) {
        // the tubes catch: a few stutters, then full light, row after row down the room
        flickerUntil = reduce ? 0 : now + 380;
        litAt = now;
      } else {
        travel.vx = travel.vd = 0;
      }
    }
    if (reduce) lightE = on ? 1 : 0;
    return new Promise((res) => {
      if (lightE === (on ? 1 : 0)) res();
      else lightWaiters.push(res);
    });
  }
  function flick(t) {
    if (t < 0) return 0;
    if (t >= 380) return 1;
    return FLICKER[Math.min(FLICKER.length - 1, Math.floor((t / 380) * FLICKER.length))];
  }

  /* ---------- Hands on: picking, rocking, flicking, the enlarger switch, wandering ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hitTest(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [];
    prints.forEach((p) => { if (p.hang.visible) targets.push(p.img); });
    hall.imgs.forEach((m) => { if (m.count) targets.push(m); });
    if (lightE < 0.5) {
      trays.forEach((t) => targets.push(t.liquidMesh, t.group.children[0]));
      enlargerParts.forEach((m) => targets.push(m));
    }
    const hits = ray.intersectObjects(targets, false);
    if (!hits.length) return null;
    let h = hits[0];
    // a print lying under the developer counts as the print, not the liquid
    if (h.object.userData.kind === "tray") {
      const under = hits.find((x) => x.object.userData.kind === "print" && x.distance < h.distance + 0.08);
      if (under) h = under;
    }
    const ud = h.object.userData;
    if (ud.kind === "print") return { kind: "print", i: ud.index, pr: prints[ud.index] };
    if (ud.kind === "hall") {
      const s = hall.slotOf(ud.photo, h.instanceId);
      return s ? { kind: "hall", i: s.photo, slot: s } : null;
    }
    if (ud.kind === "tray") return { kind: "tray", tray: ud.tray };
    if (ud.kind === "enlarger") return { kind: "enlarger" };
    return null;
  }
  function screenRect(i) {
    const p = prints[i], r = canvas.getBoundingClientRect();
    p.img.geometry.computeBoundingBox();
    const bb = p.img.geometry.boundingBox;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    [[bb.min.x, bb.min.y], [bb.max.x, bb.min.y], [bb.min.x, bb.max.y], [bb.max.x, bb.max.y]].forEach((c) => {
      const v = V(c[0], c[1], 0).applyMatrix4(p.img.matrixWorld).project(camera);
      const x = r.left + (v.x * 0.5 + 0.5) * r.width, y = r.top + (-v.y * 0.5 + 0.5) * r.height;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    });
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  // The enlarger switch, pressed by hand: on while held, at least a beat.
  const manual = { on: false, since: 0, until: 0, amt: 0 };
  function pressLamp() {
    manual.on = true;
    manual.since = now;
    manual.until = now + (coarse ? 1400 : 700);
    if (o.onUse) o.onUse("lamp");
  }
  function releaseLamp() { manual.on = false; }
  function nudgeTray(t, dx, dz) {
    if (reduce) return;
    t.rk.vx += dz;
    t.rk.vz += dx;
    if (o.onUse) o.onUse("rock");
  }
  let drag = null, hoverAt = 0, hoverPt = null, flicked = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const h = hitTest(e.clientX, e.clientY);
    drag = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), hit: h, mode: "tap", samples: [] };
    if (h && h.kind === "enlarger") { drag.mode = "lamp"; pressLamp(); }
    else if (e.pointerType === "mouse" && h && h.kind === "tray") {
      drag.mode = "rock";
      h.tray.rk.held = true;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      if (o.onUse) o.onUse("rock");
    } else if (lightsOn && e.pointerType === "mouse") canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!drag || drag.id !== e.pointerId) {
      if (e.pointerType === "mouse") {
        const acc = hoverPt ? hoverPt.acc + (e.clientX - hoverPt.x) : 0;
        hoverPt = { x: e.clientX, y: e.clientY, acc };
      }
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.mode === "rock") {
      const t = drag.hit.tray, k = 0.0011;
      t.rk.tz = clamp(-(e.clientX - drag.x0) * k, -0.09, 0.09);
      t.rk.tx = clamp((e.clientY - drag.y0) * k, -0.07, 0.07);
      return;
    }
    if (lightsOn && drag.mode !== "lamp") {
      if (drag.mode === "tap" && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) {
        drag.mode = "wander";
        if (drag.type === "mouse") canvas.style.cursor = "grabbing";
        if (o.onUse) o.onUse("wander");
      }
      if (drag.mode === "wander") {
        const k = 0.0042 / Math.max(0.6, aspect < 0.85 ? 0.7 : 1);
        travel.x -= dx * k;
        if (drag.type === "mouse") travel.d = Math.max(0, travel.d - dy * k * 1.4);
        drag.samples.push({ t: e.timeStamp, dx, dy });
        if (drag.samples.length > 6) drag.samples.shift();
      }
    }
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    if (d.mode === "rock") {
      d.hit.tray.rk.held = false;
      d.hit.tray.rk.tx = d.hit.tray.rk.tz = 0;
      canvas.style.cursor = "grab";
      return;
    }
    if (d.mode === "lamp") { releaseLamp(); return; }
    if (d.mode === "wander") {
      if (!reduce && d.samples.length > 1) {
        const span = Math.max(16, d.samples[d.samples.length - 1].t - d.samples[0].t);
        const sx = d.samples.reduce((s, q) => s + q.dx, 0), sy = d.samples.reduce((s, q) => s + q.dy, 0);
        const k = 0.0042;
        travel.vx = clamp((-sx / span) * k * 1000, -6, 6);
        travel.vd = d.type === "mouse" ? clamp((-sy / span) * k * 1400, -8, 8) : 0;
      }
      return;
    }
    if (e.type !== "pointerup" || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) return;
    // a tap or a click
    const h = hitTest(e.clientX, e.clientY);
    if (!h) return;
    if (h.kind === "print" && o.onPick) o.onPick(h.i, screenRect(h.i));
    else if (h.kind === "hall" && o.onPick) o.onPick(h.i, hall.rectOf(h.slot));
    else if (h.kind === "tray") nudgeTray(h.tray, (Math.random() - 0.5) * 0.9, 0.7);
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { hoverPt = null; });
  // Hovering: the cursor says what a thing does; a print brushed past swings.
  function hover(t) {
    if (!hoverPt || drag || t - hoverAt < 60) return;
    hoverAt = t;
    const h = hitTest(hoverPt.x, hoverPt.y);
    let cur = lightsOn ? "grab" : "";
    if (h) {
      if (h.kind === "print" || h.kind === "hall") cur = "zoom-in";
      else if (h.kind === "tray") cur = "grab";
      else if (h.kind === "enlarger") cur = "pointer";
    }
    canvas.style.cursor = cur;
    const push = clamp(hoverPt.acc * 0.012, -0.6, 0.6);
    hoverPt.acc = 0;
    if (reduce || !push) return;
    if (h && h.kind === "print" && h.pr.wasHung) h.pr.sw.v += push;
    else if (h && h.kind === "hall") h.slot.v += push * 1.2;
  }

  /* ---------- Loop ---------- */
  let running = true, last = performance.now(), raf = 0, now = 0;
  // If frames run slow, render fewer pixels (checked over the first seconds).
  const perf = { n: 0, sum: 0, checks: 0 };
  function adapt(dt) {
    if (perf.checks > 3 || !running) return;
    perf.n++;
    perf.sum += dt;
    if (perf.n < 90) return;
    const avg = perf.sum / perf.n;
    perf.n = perf.sum = 0;
    perf.checks++;
    if (avg > 24 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.5);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
  }
  const camPos = V(), camLook = V();
  const trayHolds = [null, null, null];
  const tiltQ = new THREE.Quaternion(), tiltE = new THREE.Euler(), pivot = V();
  // A print lying in a tray rides with the tray when it is rocked.
  function rideTray(q, t) {
    const rk = t.rk;
    if (Math.abs(rk.x) + Math.abs(rk.z) < 1e-4) return q;
    tiltE.set(rk.x, 0, rk.z);
    tiltQ.setFromEuler(tiltE);
    pivot.set(t.spec.x, 0, t.spec.z);
    const p = q.pos.clone().sub(pivot).applyQuaternion(tiltQ).add(pivot);
    return { pos: p, rx: q.rx, rz: q.rz, s: q.s, tilt: tiltQ.clone() };
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    // Never a negative step: the visibility handlers reset the clock between frames.
    const dt = clamp(t - last, 0, 64);
    adapt(t - last);
    last = t;
    now += dt;
    const sec = now / 1000, ds = dt / 1000;
    // Still liquid and still grain for visitors who ask for less motion.
    U.time.value = reduce ? 40 : sec;
    grain.uniforms.uTime.value = reduce ? 0 : sec;

    // The path follows the scroll like film through a gate. Slow scrubbing is followed
    // closely, but a flick of the page doesn't skip through the process: it plays at
    // its own pace, hurrying only to make up a long way. Under the tubes the scroll
    // walks the drying room instead, and is followed at once.
    if (reduce) {
      pos = target;
      posV = 0;
    } else if (lightsOn || lightE > 0) {
      pos += (target - pos) * (1 - Math.exp(-dt / 110));
      posV = 0;
    } else {
      const gap = target - pos, vmax = PLAY * Math.max(1, Math.abs(gap));
      const want = clamp(gap * 4, -vmax, vmax), acc = (vmax / 0.4) * ds;
      posV += clamp(want - posV, -acc, acc);
      pos += posV * ds;
      // never past where the page is
      if ((target - pos) * gap <= 0) { pos = target; posV = 0; }
    }
    if (Math.abs(target - pos) < 0.0005) { pos = target; posV = 0; }
    if (intro < 1 && introStart >= 0) intro = clamp((now - introStart) / INTRO_MS, 0, 1);
    const q = intro;

    // Lights: the mix (what the lamps do) and the move (the camera to the room).
    if (lightsOn) {
      if (now < flickerUntil) lightM = flick(380 - (flickerUntil - now));
      else lightM = 1;
      if (now > flickerUntil - 100) lightE = reduce ? 1 : Math.min(1, lightE + dt / 1500);
    } else {
      lightM = 0;
      lightE = reduce ? 0 : Math.max(0, lightE - dt / 1200);
    }
    if (Math.abs(lightM - appliedM) > 0.001) { setLightMix(lightM); appliedM = lightM; }
    if (lightWaiters.length && lightE === (lightsOn ? 1 : 0)) lightWaiters.splice(0).forEach((f) => f());
    const eAll = E.inOut(lightE);
    // the tubes catch row after row, away down the room, and the room opens up behind them
    for (let r = 0; r < hall.rows; r++) {
      const rowDepth = Math.max(0, (HALL.z0 - hall.rowZ[r]) - Math.max(0, HALL.z0 - camPos.z));
      hall.tubeOn[r] = lightsOn ? (reduce ? 1 : flick(now - litAt - 120 - rowDepth * 95)) : 0;
    }
    const reveal = lightsOn ? (reduce ? 1 : clamp((now - litAt - 150) / 1500, 0, 1)) : 0;
    scene.fog.near = lerp(FOG.safe[0], FOG.lit[0], lightM);
    scene.fog.far = lerp(FOG.safe[1], FOG.lit[1], smooth(reveal) * lightM);
    hall.setMix(lightM, scene.fog.near, scene.fog.far);

    // Every print: where the path puts it, pulled up onto the line by the light.
    const { i, f } = split(pos);
    let inDev = null, held = null;
    trayHolds[0] = trayHolds[1] = trayHolds[2] = null;
    const stagger = Math.min(0.06, 0.4 / Math.max(1, N));
    prints.forEach((pr, k) => {
      const st = pathState(k, pos, q);
      const ek = lightE > 0 ? smooth(clamp((lightE - k * stagger) / (1 - (N - 1) * stagger), 0, 1)) : 0;
      let pz = st.pose, vis = st.vis, dev = st.dev;
      if (ek > 0) {
        pz = blendPose(st.vis ? st.pose : pose.easel(pr), pose.line(pr), ek, 0.1);
        vis = true;
        dev = Math.max(dev, smooth(clamp(ek * 1.6, 0, 1)));
      }
      pr.hang.visible = vis && !!pr.ready;
      if (!pr.hang.visible) return;
      if (st.tray && ek < 0.02) pz = rideTray(pz, st.tray);
      setPose(pr, pz);
      if (pz.tilt) { pr.hang.quaternion.premultiply(pz.tilt); }
      const hung = (st.hung && ek < 0.02) || ek > 0.98;
      // clipped on: it swings, and settles
      if (hung && !pr.wasHung && !reduce) pr.sw.v += ek > 0.98 ? 0.5 : 1.2;
      pr.wasHung = hung;
      pr.clips.forEach((c) => (c.visible = hung));
      if (hung && !reduce) {
        pr.sw.v += (-34 * pr.sw.a - 1.2 * pr.sw.v) * ds;
        pr.sw.a += pr.sw.v * ds;
        pr.sw.w += (-26 * pr.sw.b - 1.5 * pr.sw.w) * ds + pr.sw.v * 0.15 * ds;
        pr.sw.b += pr.sw.w * ds;
        pr.hang.rotation.z += pr.sw.a + 0.006 * Math.sin(sec * 0.8 + k * 1.7);
        pr.hang.rotation.x += pr.sw.b;
      } else {
        pr.sw.a = pr.sw.v = pr.sw.b = pr.sw.w = 0;
      }
      if (Math.abs(pr.devK - dev) > 0.0005 || appliedM !== pr.mAt) { pr.devK = dev; pr.mAt = appliedM; applyDev(pr); }
      if (st.tray && ek < 0.5) {
        trayHolds[st.tray.idx] = pr;
        if (st.tray === devTray) inDev = pr;
      }
      if (st.held && ek < 0.5) held = pr;
    });

    // Splashes where paper meets the liquid or leaves it, whichever way the scroll runs.
    const cross = (a) => (prevF < a && f >= a) || (prevF >= a && f < a);
    const at = (tray, p) => { const tp = pose.tray(p, tray); splash(tray, tp.pos.x, tp.pos.z + p.ph / 2); };
    if (i === prevI && i + 1 < N) {
      if (cross(PH.drop1)) at(devTray, prints[i + 1]);
      if (cross(PH.grip)) at(devTray, prints[i]);
      if (cross(PH.stopIn) || cross(PH.stopOut)) at(stopTray, prints[i]);
      if (cross(PH.fixIn) || cross(PH.fixOut)) at(fixTray, prints[i]);
    }
    if ((prevQ < IN.drop1 && q >= IN.drop1)) at(devTray, prints[0]);
    prevI = i; prevF = f; prevQ = q;

    // The trays: rocked by hand on a spring, the liquid sloshing; rocked by the process while a print is in.
    trays.forEach((tr) => {
      const rk = tr.rk;
      if (!reduce) {
        const kx = rk.held ? 220 : 90, c = rk.held ? 26 : 5.5;
        rk.vx += (-(rk.x - rk.tx) * kx - rk.vx * c) * ds;
        rk.vz += (-(rk.z - rk.tz) * kx - rk.vz * c) * ds;
        rk.x = clamp(rk.x + rk.vx * ds, -0.1, 0.1);
        rk.z = clamp(rk.z + rk.vz * ds, -0.12, 0.12);
      } else {
        rk.x = rk.z = rk.vx = rk.vz = 0;
      }
      tr.group.rotation.set(rk.x, 0, rk.z);
      // the liquid stays level while the tray tilts under it
      tr.liquidMesh.rotation.set(-rk.x, 0, -rk.z);
      const speed = Math.abs(rk.vx) + Math.abs(rk.vz);
      const sl = tr.u.uSlosh.value;
      const amp = clamp(speed * 0.9 + (Math.abs(rk.x) + Math.abs(rk.z)) * 4, 0, 1.4);
      sl.z = lerp(sl.z, amp, 1 - Math.exp(-dt / 120));
      if (speed > 0.02) { sl.x = lerp(sl.x, -rk.vz, 0.2); sl.y = lerp(sl.y, rk.vx, 0.2); const n = Math.hypot(sl.x, sl.y) || 1; sl.x /= n; sl.y /= n; }
      const busy = trayHolds[tr.idx];
      const want = tr === devTray ? (inDev && inDev.devK > 0.001 && inDev.devK < 0.999 ? 1 : 0.12) : (busy ? 0.55 : 0.1);
      tr.u.uAgit.value = lerp(tr.u.uAgit.value, want, 1 - Math.exp(-dt / 400));
    });
    // The developer's glare steps off a print once it has come up.
    const glare = inDev ? lerp(1, 0.12, smooth(clamp((inDev.devK - 0.85) / 0.15, 0, 1))) : 1;
    devTray.liquid.specularIntensity = lerp(devTray.liquid.specularIntensity, glare, 1 - Math.exp(-dt / 300));
    devTray.liquid.envMapIntensity = lerp(devTray.liquid.envMapIntensity, 1.6 * glare, 1 - Math.exp(-dt / 300));

    // The tongs: on the print from the developer to the line, otherwise resting across the stop tray.
    const tk = lightE > 0.02 ? 0 : (held ? 1 : tongPath(pos));
    if (held || tk > 0) {
      const src = held || prints[i];
      if (src && src.hang.visible) {
        tongGrip.pos.copy(src.hang.position).add(V(src.pw * 0.18, 0, 0).applyQuaternion(src.hang.quaternion));
        tongGrip.quat.copy(tongQuat);
      }
    }
    tongs.position.copy(tongRest.pos).lerp(tongGrip.pos.clone().sub(V(0.01, 0, 0).applyQuaternion(tongGrip.quat)), tk);
    tongs.quaternion.copy(tongRest.quat).slerp(tongGrip.quat, tk);
    safeLid.rotation.x = -1.05 * lidPath(pos, q);

    // The enlarger lamp: along the path, or by hand.
    const pl = pathLamp(pos, q);
    if (manual.on || now < manual.until) manual.amt = Math.min(1, manual.amt + dt / (reduce ? 1 : 90));
    else manual.amt = Math.max(0, manual.amt - dt / (reduce ? 1 : 140));
    const lampAmt = lightE > 0.5 ? 0 : Math.max(pl.amt, manual.amt);
    const projK = pl.amt > 0 && pl.k >= 0 ? pl.k : (shown >= 0 ? shown : 0);
    if (lampAmt > 0.001 && projK !== projected) setProjection(projK);
    const shimmer = reduce ? 1 : 0.94 + 0.06 * Math.sin(sec * 47) * Math.sin(sec * 13);
    projU.uAmt.value = lampAmt * shimmer;
    beamU.uAmt.value = lampAmt * 0.09 * shimmer;
    dustU.uAmt.value = lampAmt * 0.45;
    projPlane.visible = beam.visible = dust.visible = lampAmt > 0.001;
    if (dust.visible) placeDust(reduce ? 0 : sec);
    enlLight.intensity = lampAmt * 0.3;
    lensGlow.emissiveIntensity = lampAmt * 3;
    expButton.emissiveIntensity = 0.15 + lampAmt * 1.8;
    // the timer counts the exposure down
    let expLeft = EXP_SECONDS;
    if (pl.amt > 0) expLeft = EXP_SECONDS * (1 - pl.t);
    else if (manual.amt > 0 && (manual.on || now < manual.until)) expLeft = Math.max(0, EXP_SECONDS - (now - manual.since) / 1000);
    led.set(expLeft.toFixed(1));

    // The print being worked on: full-size texture, the caption, the clock, the HUD.
    const introing = q < 1 && pos < 0.02;
    const showIdx = introing ? 0 : (f >= PH.letGo && i + 1 < N ? i + 1 : i);
    if (showIdx !== shown) {
      if (shown >= 0 && prints[shown]) dropFull(prints[shown]);
      shown = showIdx;
      useFull(prints[shown]);
    }
    const sp = prints[shown];
    // What the timer reads: the exposure counting down, then the developer, stop and fixer counting up.
    let label = "Dev", value = 0, kind = "time";
    if (shown === i && !introing && i + 1 <= N - 1 && f > PH.grip) {
      if (f <= PH.stopOut) { label = "Stop"; value = Math.round(15 * seg(f, PH.grip, PH.stopOut)); }
      else if (f <= PH.fixOut + 0.02) { label = "Fix"; value = Math.round(120 * seg(f, PH.stopOut, PH.fixOut)); }
      else { label = "Dry"; kind = "none"; }
    } else {
      const P2 = introing ? IN : PH, t2 = introing ? q : f;
      const fresh = introing || shown !== i;
      if (fresh && t2 < P2.drop1) {
        label = "Exp";
        kind = "exp";
        value = t2 < P2.exp0 ? EXP_SECONDS : t2 < P2.exp1 ? expLeft : 0;
      } else value = Math.round((sp ? sp.devK : 1) * DEV_SHOWN);
    }
    setHands(kind === "time" ? value : 0);
    const key = shown + "|" + label + "|" + (kind === "exp" ? value.toFixed(1) : value);
    if (key !== hudKey && o.onState) {
      hudKey = key;
      o.onState({ index: shown, label, value, kind, phase: label === "Dev" && value >= DEV_SHOWN ? "developed" : label.toLowerCase(), seconds: label === "Dev" ? value : 0 });
    }

    // Camera: the path, lifted into the drying room by the light.
    if (lightsOn && !drag && !reduce) {
      travel.x += travel.vx * ds;
      travel.d = Math.max(0, travel.d + travel.vd * ds);
      const decay = Math.exp(-dt / 420);
      travel.vx *= decay;
      travel.vd *= decay;
    }
    if (!lightsOn && lightE === 0) { travel.x = travel.d = travel.vx = travel.vd = 0; }
    travel.ax = reduce ? travel.x : lerp(travel.ax, travel.x, 1 - Math.exp(-dt / 90));
    travel.ad = reduce ? travel.d : lerp(travel.ad, travel.d, 1 - Math.exp(-dt / 90));
    const pc = pathCam(pos, q);
    const goalView = eAll > 0 ? mixView(pc, hallView(), eAll) : pc;
    const kc = reduce ? 1 : 1 - Math.exp(-(dt / 1000) * 5);
    view.pos.lerp(goalView.pos, kc);
    view.look.lerp(goalView.look, kc);
    camPos.copy(view.pos);
    camLook.copy(view.look);
    if (!reduce) {
      camPos.x += pointer.x * 0.025;
      camPos.y += -pointer.y * 0.015;
      camPos.y += Math.sin(now / 2600) * 0.003;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // The drying room around wherever the camera is.
    hall.place(camPos.x, camPos.z, reduce ? 0 : sec, reduce);
    floor.position.x = camPos.x;
    floor.position.z = camPos.z - 20;
    hover(t);
    if (running) {
      if (direct) renderer.render(scene, camera);
      else composer.render();
      if (health.reading) {
        if (finishRead()) { health.reading = false; judge(t); }
      } else if (health.from >= 0 && ++health.frames >= health.from && t >= health.after) {
        if (startRead()) judge(t);
        else health.reading = true;
      }
    }
  }

  /* ---------- Is the room really on screen? ----------
     Some phone GPUs fail at a part of this scene and draw the whole frame black.
     A few frames in, and twice more as the opening plays, a few patches of the
     frame are read back: under the safelight or the tubes there is always light
     on the bench. If there is none, the most demanding effect left goes and the
     frame is looked at again; if nothing helps, the flat darkroom takes over. */
  const glc = renderer.getContext();
  const FALLBACKS = [
    ["refraction", () => clearMats.forEach((c) => plainClear(c.m, c.dim))],
    ["bloom", () => { bloom.enabled = false; }],
    ["shadows", () => { noShadows = true; spot.castShadow = sun.castShadow = false; }],
    ["reflections", () => { noEnv = true; scene.environment = null; }],
    ["post-processing", () => { direct = true; }]
  ];
  // A check comes once `from` frames have been drawn and the clock has passed `after`.
  const health = { frames: 0, from: 4, after: 0, passes: 0, reading: false, step: coarse ? 1 : 0, dropped: coarse ? ["refraction"] : [], shares: [] };
  // Nine 16 px patches at the quarter points of the frame. With WebGL 2 they are copied
  // into a buffer on the GPU and read once the GPU signals it has finished, so the page
  // never waits on the GPU; WebGL 1 reads them at once.
  const PATCH_BYTES = 16 * 16 * 4, pixels = new Uint8Array(PATCH_BYTES * 9);
  const gl2 = renderer.capabilities.isWebGL2;
  let packBuf = null, fence = null;
  function startRead() {
    renderer.setRenderTarget(null);
    if (gl2) {
      renderer.state.bindFramebuffer(glc.READ_FRAMEBUFFER, null);
      if (!packBuf) {
        packBuf = glc.createBuffer();
        glc.bindBuffer(glc.PIXEL_PACK_BUFFER, packBuf);
        glc.bufferData(glc.PIXEL_PACK_BUFFER, pixels.byteLength, glc.STREAM_READ);
      } else glc.bindBuffer(glc.PIXEL_PACK_BUFFER, packBuf);
    }
    const w = glc.drawingBufferWidth, h = glc.drawingBufferHeight;
    for (let k = 0; k < 9; k++) {
      const x = Math.round((((k % 3) + 1) * w) / 4) - 8, y = Math.round(((Math.floor(k / 3) + 1) * h) / 4) - 8;
      if (gl2) glc.readPixels(x, y, 16, 16, glc.RGBA, glc.UNSIGNED_BYTE, k * PATCH_BYTES);
      else glc.readPixels(x, y, 16, 16, glc.RGBA, glc.UNSIGNED_BYTE, pixels.subarray(k * PATCH_BYTES, (k + 1) * PATCH_BYTES));
    }
    if (!gl2) return true;
    glc.bindBuffer(glc.PIXEL_PACK_BUFFER, null);
    fence = glc.fenceSync(glc.SYNC_GPU_COMMANDS_COMPLETE, 0);
    glc.flush();
    return false;
  }
  function finishRead() {
    if (fence && glc.clientWaitSync(fence, 0, 0) === glc.TIMEOUT_EXPIRED) return false;
    if (fence) glc.deleteSync(fence);
    fence = null;
    glc.bindBuffer(glc.PIXEL_PACK_BUFFER, packBuf);
    glc.getBufferSubData(glc.PIXEL_PACK_BUFFER, 0, pixels);
    glc.bindBuffer(glc.PIXEL_PACK_BUFFER, null);
    return true;
  }
  function litShare() {
    let lit = 0;
    for (let k = 0; k < pixels.length; k += 4) {
      // the film grain alone reaches about 6; the darkest healthy view has 13% of its pixels above 14
      if (Math.max(pixels[k], pixels[k + 1], pixels[k + 2]) > 14) lit++;
    }
    return lit / (pixels.length / 4);
  }
  function judge(t) {
    const share = litShare();
    health.shares.push(Math.round(share * 1000) / 1000);
    if (share >= 0.02) {
      // fine: look again in a moment, and once more as the opening plays
      health.passes++;
      if (health.passes >= 3) {
        health.from = -1;
        report("drawn");
      } else {
        health.from = health.frames + 2;
        health.after = t + (health.passes === 1 ? 800 : 2500);
      }
      return;
    }
    if (health.step < FALLBACKS.length) {
      const [name, drop] = FALLBACKS[health.step++];
      drop();
      health.dropped.push(name);
      health.passes = 0;
      health.from = health.frames + 3;
      health.after = 0;
      return;
    }
    health.from = -1;
    report("flat");
    running = false;
    cancelAnimationFrame(raf);
    if (o.onLost) o.onLost();
  }
  function report(state) {
    if (!o.onDiag) return;
    let gpu = "";
    try {
      const dbg = glc.getExtension("WEBGL_debug_renderer_info");
      gpu = String(glc.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : glc.RENDERER));
    } catch (e) { /* not told */ }
    o.onDiag({
      state, gpu, dropped: health.dropped.slice(), shares: health.shares.slice(),
      webgl2: renderer.capabilities.isWebGL2, coarse, dpr: window.devicePixelRatio || 1,
      buffer: [glc.drawingBufferWidth, glc.drawingBufferHeight],
      ext: ["EXT_color_buffer_half_float", "EXT_color_buffer_float", "OES_texture_float_linear"].filter((x) => !!glc.getExtension(x))
    });
  }

  /* If the GPU drops the context (a phone backgrounding the tab), hand back to the flat darkroom. */
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    if (o.onLost) o.onLost();
  });

  /* ---------- Start ---------- */
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  let inView = true, paused = false;
  function updateRunning() { running = inView && !paused && !document.hidden; last = performance.now(); }
  const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; updateRunning(); });
  io.observe(stage);
  document.addEventListener("visibilitychange", updateRunning);

  const r0 = asView(roomFrame());
  view.pos.copy(r0.pos);
  view.look.copy(r0.look);
  camPos.copy(r0.pos);
  // Open on the room; once the first photograph has loaded, the opening plays.
  const opening = (async () => {
    await whenReady(prints[0]);
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]);
    // Build every shader the process will need now, hidden parts included, while the
    // room is still: phones build them slowly, and a step that waited for its shaders
    // the first time it came into view would stall.
    // (Built for where the room is drawn: the post-processing buffer, unless it has been given up.)
    try {
      renderer.setRenderTarget(direct ? null : composer.readBuffer);
      renderer.compile(scene, camera);
    } catch (e) { /* they are built when first drawn instead */ }
    renderer.setRenderTarget(null);
    if (intro < 1) introStart = now + (reduce ? 0 : 400);
  })();
  setLightMix(0);
  appliedM = 0;
  raf = requestAnimationFrame(frame);

  return {
    setProgress(v) {
      target = clamp(+v || 0, 0, N - 1);
      if (target > 0.02 && intro < 1) intro = 1;
    },
    setIndex(i) { this.setProgress(i); },
    setLights,
    get index() { return shown; },
    rectFor: screenRect,
    setPaused(v) { paused = !!v; updateRunning(); },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
    },
    ready: opening
  };
}
