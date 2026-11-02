/*
 * Photography: the darkroom, in 3D.
 *
 * A wet bench under a red safelight: developer, stop and fixer trays, an
 * enlarger with its easel, chemistry bottles, and a drying line on the tiled
 * wall. Each print slides off the easel into the developer, comes up under the
 * rippling liquid, then is lifted and hung on the line while the camera
 * follows. Lights on brings up white light and hangs every print on the wall.
 *
 * darkroom.js loads this only where WebGL works; the flat darkroom is the
 * fallback. Photographs keep their own colours: the safelight tints the room
 * and the paper, never the image.
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
  in: (t) => t * t * t,
  lin: (t) => t
};

function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Scene constants (metres) ---------- */
const WALL_Z = -0.62;
const LINE_Z = -0.5;
const TRAY = { w: 0.44, d: 0.35, h: 0.055, wall: 0.012 };
const TRAYS = [
  { key: "dev", x: 0, z: 0 },
  { key: "stop", x: 0.56, z: 0.015 },
  { key: "fix", x: 1.12, z: -0.005 }
];
const LIQ_Y = 0.036;
const PRINT_Y = 0.011;
const EASEL = V(-0.95, 0.032, -0.03);
const ENL_X = -0.95;
const LINE = { x0: -1.42, x1: 1.42, y: 1.16, sag: 0.075 };
const LAMP = V(0.34, 1.42, -0.46);
const DEV_MS = 3400;
const DEV_SHOWN = 90;

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
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
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
  // UV: bench spans x -1.3..1.6 (u) and z -0.62..0.5 (v)
  const U = (x) => (x + 1.3) / 2.9, Vv = (z) => (z + 0.62) / 1.12;
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

function tileTextures() {
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
    map: texFrom(col, { srgb: true }),
    roughnessMap: texFrom(rough),
    normalMap: texFrom(nrm)
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
  scene.background = SAFE_BG.clone();
  scene.fog = new THREE.Fog(0x070202, 2.6, 6.5);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 30);

  /* Environment for reflections: a dark room with one red lamp, or a lit room. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let safeEnv = null, litEnv = null;


  /* ---------- Materials ---------- */
  const bt = benchTextures();
  const benchMat = new THREE.MeshPhysicalMaterial({
    map: bt.map, roughnessMap: bt.roughnessMap, roughness: 1, normalMap: bt.normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18), clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9
  });
  const tt = tileTextures();
  const tileRepeat = [2.9 / 0.9, 1.9 / 0.9];
  [tt.map, tt.roughnessMap, tt.normalMap].forEach((t) => t.repeat.set(tileRepeat[0], tileRepeat[1]));
  const wallMat = new THREE.MeshStandardMaterial({
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

  /* ---------- Room ---------- */
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 1.12), benchMat);
  bench.position.set(0.15, -0.03, -0.06);
  bench.receiveShadow = true;
  scene.add(bench);
  const benchEdge = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.8 }));
  benchEdge.position.set(0.15, -0.5, 0.5);
  scene.add(benchEdge);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.9), wallMat);
  wall.position.set(0.15, 0.95, WALL_Z);
  wall.receiveShadow = true;
  scene.add(wall);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.95 }));
  backdrop.position.set(0, 1.5, WALL_Z - 0.01);
  scene.add(backdrop);

  /* Trays with liquid */
  const U = { time: { value: 0 } };
  function makeTray(spec) {
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
    const floor = new THREE.Mesh(fg, trayFloorMat);
    floor.position.y = 0.004;
    floor.receiveShadow = true;
    g.add(floor);
    for (let i = -1; i <= 1; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(TRAY.w - 0.08, 0.005, 0.01), trayFloorMat);
      rib.position.set(0, 0.0065, i * 0.09);
      rib.receiveShadow = true;
      g.add(rib);
    }
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.08, ior: 1.34,
      attenuationColor: new THREE.Color(spec.key === "stop" ? 0xf2e2b8 : 0xf3ece0), attenuationDistance: 0.45,
      specularIntensity: 1, envMapIntensity: 1.6
    });
    const lu = {
      uTime: U.time,
      uCenter: { value: new THREE.Vector2(spec.x, spec.z) },
      uDrop: { value: new THREE.Vector3(0, 0, -100) },
      uAgit: { value: 0.12 }
    };
    liquidMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, lu);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vLP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvLP = (modelMatrix * vec4(transformed, 1.0)).xz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vLP;\nuniform float uTime;\nuniform vec2 uCenter;\nuniform vec3 uDrop;\nuniform float uAgit;")
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
            // a ring spreading from where the paper went in or came out
            float age = t - uDrop.z;
            if (age > 0.0 && age < 4.5) {
              vec2 dv = q - uDrop.xy;
              float d = length(dv) + 1e-4;
              float band = exp(-pow((d - age * 0.24) * 11.0, 2.0));
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
    return { group: g, spec, u: lu, liquid: liquidMat };
  }
  const trays = TRAYS.map(makeTray);
  const devTray = trays[0];

  /* Tongs resting across the stop tray */
  {
    const bamboo = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x7a1d14, roughness: 0.7 });
    const tg = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.014), bamboo);
      arm.position.set(0, 0.004 * i, i * 0.012 - 0.006);
      arm.rotation.y = (i ? 1 : -1) * 0.03;
      arm.castShadow = true;
      tg.add(arm);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.016), rubber);
      tip.position.set(-0.11, 0.004 * i, i * 0.012 - 0.006);
      tg.add(tip);
    }
    tg.position.set(0.56, TRAY.h + 0.012, 0.03);
    tg.rotation.y = -0.35;
    scene.add(tg);
  }

  /* Enlarger and easel */
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
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshPhysicalMaterial({ color: 0x101418, roughness: 0.02, clearcoat: 1 }));
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, -0.191, 0.26);
    head.add(arm, house, bellows, lens, glass);
    head.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    head.position.set(ENL_X, 0.86, -0.3);
    scene.add(head);
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
      const lt = labelTexture(labels[i][0], labels[i][1]);
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0475, 0.0475, 0.05, 32, 1, true, -0.65, 1.3), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.8 }));
      lab.position.set(p[0], 0.085, p[1]);
      scene.add(lab);
    });
  }

  /* The safelight on the wall */
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
  {
    const h = 1.5;
    const cg = new THREE.CylinderGeometry(0.06, 0.62, h, 48, 1, true);
    cg.translate(0, -h / 2, 0);
    const cm = new THREE.ShaderMaterial({
      uniforms: hazeU,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){
          vY = uv.y;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){
          float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
          float fall = pow(vY, 1.6);
          gl_FragColor = vec4(uColor * uAmt * edge * fall, 1.0);
        }`
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
  // Spill from the safelight onto the wall where the prints hang.
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
  sun.shadow.camera.left = -2;
  sun.shadow.camera.right = 2;
  sun.shadow.camera.top = 2;
  sun.shadow.camera.bottom = -1;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const litHemi = new THREE.HemisphereLight(0xe8edf2, 0x3d3833, 0);
  scene.add(litHemi);

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
    const glassC = new THREE.Mesh(new THREE.CircleGeometry(0.084, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.002, ior: 1.5 }));
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

  /* The drying line */
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
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.abs(WALL_Z - LINE_Z) + 0.01, 10), metalMat);
      hook.rotation.x = Math.PI / 2;
      hook.position.set(x, LINE.y, (WALL_Z + LINE_Z) / 2);
      scene.add(hook);
    });
  }
  const gridWires = new THREE.Group();
  scene.add(gridWires);

  /* Reflections: the room itself, seen from the developer's surface. */
  function captureEnv() {
    devTray.group.visible = false;
    scene.position.y = -LIQ_Y - 0.004;
    scene.updateMatrixWorld(true);
    const rt = pmrem.fromScene(scene, 0, 0.03, 12);
    scene.position.y = 0;
    scene.updateMatrixWorld(true);
    devTray.group.visible = true;
    return rt.texture;
  }
  safeEnv = captureEnv();
  scene.environment = safeEnv;

  /* ---------- Prints ---------- */
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
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const prints = photos.map((ph, i) => {
    const ar = ph.ar, B = 0.016;
    let pw, phh;
    if (ar >= 0.36 / 0.275) { pw = 0.36; phh = (pw - 2 * B) / ar + 2 * B; }
    else { phh = 0.275; pw = (phh - 2 * B) * ar + 2 * B; }
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
    img.userData.index = i;
    body.add(paper, img);
    const clips = [makeClip(), makeClip()];
    clips[0].position.x = -pw * 0.32;
    clips[1].position.x = pw * 0.32;
    clips.forEach((c) => { c.visible = false; hang.add(c); });
    hang.visible = false;
    scene.add(hang);
    const p = {
      i, ar, pw, ph: phh, hang, img, mat, dev, clips, developed: false, devK: 0,
      state: "off", waiters: [], swingT0: -1e9, swingAmp: 0, pose: null, texThumb: null, texFull: null
    };
    loader.load(ph.thumb, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      p.texThumb = t;
      if (!p.texFull) setTex(p, t);
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
  let emiLevel = 0.68, photoDiffuse = 0.4;
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

  /* Poses: where a print can be, and how it is held. */
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
    easel: (p) => ({ pos: V(EASEL.x, 0.041, EASEL.z - p.ph / 2), rx: -Math.PI / 2, rz: 0.03, s: 1 }),
    tray: (p) => ({ pos: V(devTray.spec.x + 0.004, PRINT_Y, devTray.spec.z - p.ph / 2 + 0.006), rx: -Math.PI / 2, rz: -0.035, s: 1 }),
    line: (p) => {
      const sl = slots[p.i];
      return { pos: V(sl.x, lineY(sl.x) - 0.002, LINE_Z + 0.004), rx: 0, rz: 0, s: sl.s };
    }
  };
  function setPose(p, q) {
    p.pose = { pos: q.pos.clone(), rx: q.rx, rz: q.rz, s: q.s };
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

  /* ---------- Camera ---------- */
  const view = { pos: V(0.4, 1.1, 2.4), look: V(0, 0.5, -0.3) };
  let aspect = 1, fov = 36;
  function fitDist(w, h) {
    const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    return Math.max(h / 2 / Math.tan(vf / 2), w / 2 / Math.tan(hf / 2));
  }
  function trayView() {
    const portrait = aspect < 0.85;
    const el = THREE.MathUtils.degToRad(portrait ? 66 : 61);
    const look = V(devTray.spec.x, 0.02, devTray.spec.z + (portrait ? 0.0 : 0.01));
    const d = fitDist(portrait ? 0.48 : 0.7, portrait ? 0.36 : 0.44);
    return { pos: look.clone().add(V(portrait ? 0 : 0.03, Math.sin(el) * d, Math.cos(el) * d)), look };
  }
  function lineView(i) {
    const sl = slots[i], p = prints[i];
    const look = V(sl.x * 0.9, lineY(sl.x) - p.ph * sl.s * 0.45, LINE_Z);
    const d = fitDist(aspect < 0.85 ? 0.62 : 1.05, 0.62);
    return { pos: look.clone().add(V(-sl.x * 0.12, -0.12, d)), look };
  }
  function roomView() {
    const look = V(0.08, 0.66, -0.3);
    const d = fitDist(aspect < 0.85 ? 1.5 : 2.3, 1.6);
    const el = THREE.MathUtils.degToRad(11);
    return { pos: look.clone().add(V(0.22, Math.sin(el) * d, Math.cos(el) * d)), look };
  }
  let pointer = { x: 0, y: 0 };

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
        float v = smoothstep(0.82, 0.22, length(d * vec2(1.05, 1.15)));
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
    if (lightsOn) layoutWall();
  }

  function splash(tray, x, z) {
    tray.u.uDrop.value.set(x - tray.spec.x, z - tray.spec.z, U.time.value);
  }
  function setHands(sec) {
    if (!timerHands.length) return;
    timerHands[0].rotation.z = -(sec / 60) * Math.PI * 2;
    timerHands[1].rotation.z = -(sec / 3600) * Math.PI * 2 - 0.5;
  }

  /* ---------- The darkroom follows the scroll ----------
     The page gives a position from 0 to N - 1. Between print i and print i + 1
     one scroll step plays the whole hand-off, and every part of it follows the
     scroll in both directions: print i is lifted out of the developer and hung
     on the line (the camera follows it up), sheet i + 1 slides off the easel
     into the tray, and develops. A whole number is a finished print in the tray. */
  const PH = { lift0: 0.02, lift1: 0.12, hang1: 0.38, slide0: 0.40, drop0: 0.52, drop1: 0.58, dev0: 0.60, dev1: 0.97 };
  const INTRO_MS = 5600;
  let target = 0, pos = 0, intro = reduce ? 1 : 0, introStart = -1;
  let lightsOn = false, lightE = 0, lightM = 0, appliedM = -1, flickerUntil = 0, lightWaiters = [];
  let shown = -1, hudKey = "";
  let prevI = 0, prevF = 0, prevQ = 0;
  const seg = (f, a, b) => clamp((f - a) / (b - a), 0, 1);
  const liftedFrom = (q) => ({ pos: q.pos.clone().add(V(0, 0.2, 0.05)), rx: q.rx + 0.9, rz: q.rz, s: 1 });
  const aboveOf = (q) => ({ pos: q.pos.clone().add(V(0, 0.07, 0)), rx: q.rx + 0.08, rz: q.rz, s: 1 });
  function mixView(a, b, k) {
    return { pos: a.pos.clone().lerp(b.pos, k), look: a.look.clone().lerp(b.look, k) };
  }
  function split(pp) {
    const i = Math.min(N - 1, Math.floor(pp));
    return { i, f: i >= N - 1 ? 0 : pp - i };
  }

  // Where print k is at this point on the path, how far it has developed, and
  // whether it hangs on the line with its clothespins.
  function pathState(k, pp, q) {
    const pr = prints[k], { i, f } = split(pp);
    const tray = pose.tray(pr), easel = pose.easel(pr), line = pose.line(pr);
    if (k < i) return { pose: line, dev: 1, vis: true, hung: true };
    if (k === i) {
      if (k === 0 && q < 1) {
        // The opening: the first sheet slides off the easel, drops in, develops.
        if (q < 0.15) return { pose: easel, dev: 0, vis: true };
        if (q < 0.38) return { pose: blendPose(easel, aboveOf(tray), E.inOut(seg(q, 0.15, 0.38)), 0.06), dev: 0, vis: true };
        if (q < 0.45) return { pose: blendPose(aboveOf(tray), tray, E.in(seg(q, 0.38, 0.45)), 0), dev: 0, vis: true };
        return { pose: tray, dev: smooth(seg(q, 0.47, 0.97)), vis: true, inTray: true };
      }
      if (f <= PH.lift0) return { pose: tray, dev: 1, vis: true, inTray: true };
      if (f <= PH.lift1) return { pose: blendPose(tray, liftedFrom(tray), E.out(seg(f, PH.lift0, PH.lift1)), 0), dev: 1, vis: true };
      if (f <= PH.hang1) return { pose: blendPose(liftedFrom(tray), line, E.inOut(seg(f, PH.lift1, PH.hang1)), 0.14), dev: 1, vis: true };
      return { pose: line, dev: 1, vis: true, hung: true };
    }
    if (k === i + 1) {
      if (f < PH.slide0) return { pose: easel, dev: 0, vis: f > 0.05 };
      if (f < PH.drop0) return { pose: blendPose(easel, aboveOf(tray), E.inOut(seg(f, PH.slide0, PH.drop0)), 0.06), dev: 0, vis: true };
      if (f < PH.drop1) return { pose: blendPose(aboveOf(tray), tray, E.in(seg(f, PH.drop0, PH.drop1)), 0), dev: 0, vis: true };
      return { pose: tray, dev: smooth(seg(f, PH.dev0, PH.dev1)), vis: true, inTray: true };
    }
    return { pose: easel, dev: 0, vis: false };
  }
  // The camera on the same path: at the tray, up to the line while a print is hung, back down.
  function pathCam(pp, q) {
    const tv = trayView();
    if (q < 1 && pp < 0.02) return mixView(roomView(), tv, E.inOut(seg(q, 0.08, 0.45)));
    const { i, f } = split(pp);
    if (i >= N - 1) return tv;
    const up = E.inOut(seg(f, 0.06, 0.25)), down = E.inOut(seg(f, 0.34, 0.52));
    return mixView(mixView(tv, lineView(i), up), tv, down);
  }

  /* ---------- Lights on: everything on the wall ---------- */
  let wallSlots = [], wallRegion = null;
  function layoutWall() {
    const portrait = aspect < 0.85;
    // below the hanging safelight, above the bench clutter
    const W = portrait ? 1.0 : 2.05, top = 1.2, bottom = portrait ? 0.3 : 0.36;
    const cx = portrait ? 0.3 : 0.37;
    const H = top - bottom;
    const gap = 0.075, rowGap = 0.09;
    let best = null;
    for (let h = 0.46; h >= 0.05; h -= 0.005) {
      const rows = [[]];
      let x = 0;
      prints.forEach((p) => {
        const w = (p.pw / p.ph) * h;
        if (x > 0 && x + w > W) { rows.push([]); x = 0; }
        rows[rows.length - 1].push({ p, w });
        x += w + gap;
      });
      if (rows.length * (h + rowGap) - rowGap <= H) { best = { h, rows }; break; }
    }
    if (!best) best = { h: 0.05, rows: [prints.map((p) => ({ p, w: (p.pw / p.ph) * 0.05 }))] };
    wallSlots = [];
    const totalH = best.rows.length * (best.h + rowGap) - rowGap;
    let y = (top + bottom) / 2 + totalH / 2;
    while (gridWires.children.length) {
      const m = gridWires.children.pop();
      m.geometry.dispose();
    }
    best.rows.forEach((row) => {
      const rw = row.reduce((s, it) => s + it.w + gap, -gap);
      let x = cx - rw / 2;
      row.forEach((it) => {
        wallSlots[it.p.i] = { x: x + it.w / 2, y, s: best.h / it.p.ph };
        x += it.w + gap;
      });
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, W + 0.3, 6), metalMat);
      wire.rotation.z = Math.PI / 2;
      wire.position.set(cx, y + 0.002, LINE_Z);
      gridWires.add(wire);
      y -= best.h + rowGap;
    });
    // Frame the prints themselves, with some wall and bench around them.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    prints.forEach((p) => {
      const sl = wallSlots[p.i], w = p.pw * sl.s;
      x0 = Math.min(x0, sl.x - w / 2); x1 = Math.max(x1, sl.x + w / 2);
      y1 = Math.max(y1, sl.y); y0 = Math.min(y0, sl.y - p.ph * sl.s);
    });
    const fw = Math.max(x1 - x0 + 0.5, portrait ? 0.9 : 1.4), fh = Math.max(y1 - y0 + 0.45, 0.8);
    wallRegion = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - 0.04, w: fw, h: fh };
  }
  function wallPose(p) {
    if (!wallSlots[p.i]) layoutWall();
    const s = wallSlots[p.i];
    return { pos: V(s.x, s.y, LINE_Z + 0.004), rx: 0, rz: 0, s: s.s };
  }
  function wallView() {
    if (!wallRegion) layoutWall();
    const r = wallRegion;
    const look = V(r.cx, r.cy, LINE_Z);
    const d = fitDist(r.w, r.h);
    return { pos: look.clone().add(V(0, 0.05, d)), look };
  }

  function setLightMix(m) {
    // m = 0 safelight, 1 white light
    spot.intensity = 3.6 * (1 - m);
    lampFill.intensity = 0.55 * (1 - m);
    lineWash.intensity = 0.75 * (1 - m);
    hemi.intensity = 0.22 * (1 - m);
    // Under white light the print shows exactly its own pixels.
    emiLevel = lerp(0.68, 1, m);
    photoDiffuse = lerp(0.4, 0, m);
    filterMat.emissiveIntensity = lerp(4.2, 0.25, m);
    hazeU.uAmt.value = 0.16 * (1 - m);
    sun.intensity = 2.6 * m;
    litHemi.intensity = 1.25 * m;
    // Only the light that is on casts shadows (one shadow map per frame).
    sun.castShadow = m > 0.5;
    spot.castShadow = m <= 0.5;
    // The safelight is put away for the lit wall so it never hangs over a print.
    lampGroup.visible = lampCord.visible = m <= 0.5;
    scene.background.copy(SAFE_BG).lerp(LIT_BG, m);
    scene.fog.color.copy(SAFE_BG).lerp(LIT_BG, m);
    bloom.strength = lerp(0.55, 0.1, m);
    grain.uniforms.uVig.value = lerp(0.42, 0.08, m);
    grain.uniforms.uGrain.value = lerp(0.045, 0.012, m);
    // The lit room's reflections are captured once, the first time the lights are fully up.
    if (m >= 0.999 && !litEnv) litEnv = captureEnv();
    scene.environment = m > 0.5 && litEnv ? litEnv : safeEnv;
    gridWires.visible = m > 0.5;
    lineWire.visible = m <= 0.5;
  }
  function setLights(on) {
    if (on !== lightsOn) {
      lightsOn = on;
      if (on) {
        layoutWall();
        // the tubes catch: a few stutters, then full light
        flickerUntil = reduce ? 0 : now + 380;
      }
    }
    if (reduce) lightE = on ? 1 : 0;
    return new Promise((res) => {
      if (lightE === (on ? 1 : 0)) res();
      else lightWaiters.push(res);
    });
  }
  const FLICKER = [0.7, 0.05, 0.45, 0.1, 0.9];

  /* ---------- Picking prints ---------- */
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hits = ray.intersectObjects(prints.filter((p) => p.hang.visible).map((p) => p.img), false);
    return hits.length ? hits[0].object.userData.index : -1;
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
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
    const i = pick(e.clientX, e.clientY);
    if (i >= 0 && o.onPick) o.onPick(i, screenRect(i));
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType === "mouse") canvas.style.cursor = pick(e.clientX, e.clientY) >= 0 ? "zoom-in" : "";
  });

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
  function frame(t) {
    raf = requestAnimationFrame(frame);
    // Never a negative step: the visibility handlers reset the clock between frames.
    const dt = clamp(t - last, 0, 64);
    adapt(t - last);
    last = t;
    now += dt;
    // Still liquid and still grain for visitors who ask for less motion.
    U.time.value = reduce ? 40 : now / 1000;
    grain.uniforms.uTime.value = reduce ? 0 : now / 1000;

    // The path position eases after the scroll so scrubbing feels like film, not steps.
    pos = reduce ? target : pos + (target - pos) * (1 - Math.exp(-dt / 110));
    if (Math.abs(target - pos) < 0.0005) pos = target;
    if (intro < 1 && introStart >= 0) intro = clamp((now - introStart) / INTRO_MS, 0, 1);
    const q = intro;

    // Lights: the mix (what the lamps do) and the move (prints to the wall).
    if (lightsOn) {
      if (now < flickerUntil) lightM = FLICKER[Math.min(FLICKER.length - 1, Math.floor((1 - (flickerUntil - now) / 380) * FLICKER.length))];
      else lightM = 1;
      if (now > flickerUntil - 100) lightE = reduce ? 1 : Math.min(1, lightE + dt / 1400);
    } else {
      lightM = 0;
      lightE = reduce ? 0 : Math.max(0, lightE - dt / 1200);
    }
    if (Math.abs(lightM - appliedM) > 0.001) { setLightMix(lightM); appliedM = lightM; }
    if (lightWaiters.length && lightE === (lightsOn ? 1 : 0)) lightWaiters.splice(0).forEach((f) => f());
    const eAll = E.inOut(lightE);

    // Every print: where the path puts it, pulled towards the wall by the light.
    const { i, f } = split(pos);
    let inTray = null;
    const stagger = Math.min(0.06, 0.4 / Math.max(1, N));
    prints.forEach((pr, k) => {
      const st = pathState(k, pos, q);
      const ek = lightE > 0 ? smooth(clamp((lightE - k * stagger) / (1 - (N - 1) * stagger), 0, 1)) : 0;
      let pz = st.pose, vis = st.vis, dev = st.dev;
      if (ek > 0) {
        pz = blendPose(st.vis ? st.pose : pose.easel(pr), wallPose(pr), ek, 0.1);
        vis = true;
        dev = Math.max(dev, smooth(clamp(ek * 1.6, 0, 1)));
      }
      pr.hang.visible = vis && !!pr.ready;
      if (!pr.hang.visible) return;
      setPose(pr, pz);
      const hung = (st.hung && ek < 0.02) || ek > 0.98;
      if (hung && !pr.wasHung) { pr.swingT0 = now; pr.swingAmp = ek > 0.98 ? 0.07 : 0.2; }
      pr.wasHung = hung;
      pr.clips.forEach((c) => (c.visible = hung));
      if (hung && !reduce) {
        const age = (now - pr.swingT0) / 1000;
        const a = pr.swingAmp * Math.exp(-age * 1.1);
        pr.hang.rotation.z += a * Math.sin(age * 5.2) + 0.006 * Math.sin(now / 1000 * 0.8 + k * 1.7);
        pr.hang.rotation.x += 0.5 * a * Math.sin(age * 4.1 + 1.2);
      }
      if (Math.abs(pr.devK - dev) > 0.0005 || appliedM !== pr.mAt) { pr.devK = dev; pr.mAt = appliedM; applyDev(pr); }
      if (st.inTray && ek < 0.5) inTray = pr;
    });

    // Splashes where paper meets the developer, in the direction of travel.
    if (i === prevI) {
      if (prevF < PH.drop1 && f >= PH.drop1 && i + 1 < N) { const t2 = pose.tray(prints[i + 1]); splash(devTray, t2.pos.x, t2.pos.z + prints[i + 1].ph / 2); }
      if (prevF < PH.lift0 && f >= PH.lift0) { const t1 = pose.tray(prints[i]); splash(devTray, t1.pos.x, t1.pos.z + prints[i].ph / 2); }
    }
    if (prevQ < 0.45 && q >= 0.45) { const t0 = pose.tray(prints[0]); splash(devTray, t0.pos.x, t0.pos.z + prints[0].ph / 2); }
    prevI = i; prevF = f; prevQ = q;

    // The developer: rocked while a print comes up, calm and out of the way once it has.
    const developing = inTray && inTray.devK > 0.001 && inTray.devK < 0.999;
    devTray.u.uAgit.value = lerp(devTray.u.uAgit.value, developing ? 1 : 0.12, 1 - Math.exp(-dt / 400));
    const glare = inTray ? lerp(1, 0.12, smooth(clamp((inTray.devK - 0.85) / 0.15, 0, 1))) : 1;
    devTray.liquid.specularIntensity = lerp(devTray.liquid.specularIntensity, glare, 1 - Math.exp(-dt / 300));
    devTray.liquid.envMapIntensity = lerp(devTray.liquid.envMapIntensity, 1.6 * glare, 1 - Math.exp(-dt / 300));

    // The print in the tray: full-size texture, the caption, the timer.
    const showIdx = inTray ? inTray.i : (f >= PH.drop1 && i + 1 < N ? i + 1 : i);
    if (showIdx !== shown) {
      if (shown >= 0 && prints[shown]) dropFull(prints[shown]);
      shown = showIdx;
      useFull(prints[shown]);
    }
    const sec = Math.round((prints[shown] ? prints[shown].devK : 1) * DEV_SHOWN);
    setHands(sec);
    const phase = sec < DEV_SHOWN ? "developing" : "developed";
    const key = shown + "|" + sec + "|" + phase;
    if (key !== hudKey && o.onState) { hudKey = key; o.onState({ index: shown, phase, seconds: sec }); }

    // Camera: the path, pulled to the wall by the light.
    const pc = pathCam(pos, q);
    const goalView = eAll > 0 ? mixView(pc, wallView(), eAll) : pc;
    const k = reduce ? 1 : 1 - Math.exp(-(dt / 1000) * 5);
    view.pos.lerp(goalView.pos, k);
    view.look.lerp(goalView.look, k);
    camPos.copy(view.pos);
    camLook.copy(view.look);
    if (!reduce) {
      camPos.x += pointer.x * 0.025;
      camPos.y += -pointer.y * 0.015;
      camPos.y += Math.sin(now / 2600) * 0.003;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (running) composer.render();
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

  const r0 = roomView();
  view.pos.copy(r0.pos);
  view.look.copy(r0.look);
  // Open on the room; once the first photograph has loaded, the opening plays.
  const opening = (async () => {
    await whenReady(prints[0]);
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]);
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
