#!/usr/bin/env node
// The spot on the film (assets/img/teardown/lens-psf.json), for the page "The camera, taken apart":
// what one point of a subject 1 m away makes on the film, the lens's point spread function, for
// each of the lens's eleven distance settings and seven apertures. Wave optics, for green light
// (550 nm): every ray from the point is traced through the glass with the page's own tracer
// (assets/js/camera-lens.js, so the spots and the drawing agree), its optical path to a sphere
// centred on the film's axis point gives the wavefront, and the Debye integral of the round pupil
// (a Hankel transform) gives the light on the film. Defocus, the glass's own aberrations and
// diffraction all come out of the one calculation.
//
// Two square views of each spot, each stored out to its corners as one byte per sample,
// gamma-encoded for the screen and scaled to the view's own brightest:
//   wide:   1.6 mm across; the light averaged over rings 4 µm wide (what a pixel of that size would
//           collect), so a spot smaller than a pixel still shows, and the fine ripples inside a
//           blurred disc (finer than a pixel) do not alias into false rings;
//   centre: 64 µm across, sampled every 0.2 µm.
// And for each: the diameter holding 80% of the light (d80, mm).
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '../..');
const L = JSON.parse(fs.readFileSync(path.join(root, 'assets/img/teardown/lens.json'), 'utf8'));
// the page's script, run with a stand-in for the browser's window
const win = {};
new Function('window', fs.readFileSync(path.join(root, 'assets/js/camera-lens.js'), 'utf8'))(win);
const CL = win.CameraLens;

const SUBJECT = 1000;                                       // mm from the film
const FOCUS = [Infinity, 10000, 5000, 3000, 2000, 1500, 1200, 1000, 900, 800, 700];
const STOPS = CL.STOPS;
const LAMBDA = 0.00055, K = 2 * Math.PI / LAMBDA;
const PUPIL = 7200;                                         // rays across the pupil's radius
// each view: half its width, and its ring width or sample step, out to the corners (mm)
const WIDE = { half: 0.8, bin: 0.004 }, CENTRE = { half: 0.032, step: 0.0002 };
WIDE.n = Math.ceil(WIDE.half * Math.SQRT2 / WIDE.bin);
CENTRE.n = Math.ceil(CENTRE.half * Math.SQRT2 / CENTRE.step) + 1;
const REACH = WIDE.n * WIDE.bin;
const GAMMA = 0.45;

// J0: Abramowitz and Stegun 9.4.1 and 9.4.3, tabulated
function j0x(x) {
  x = Math.abs(x);
  if (x <= 3) { const y = (x / 3) ** 2; return 1 + y * (-2.2499997 + y * (1.2656208 + y * (-0.3163866 + y * (0.0444479 + y * (-0.0039444 + y * 0.00021))))); }
  const y = 3 / x;
  const f = 0.79788456 + y * (-0.00000077 + y * (-0.0055274 + y * (-0.00009512 + y * (0.00137237 + y * (-0.00072805 + y * 0.00014476)))));
  const t = x - 0.78539816 + y * (-0.04166397 + y * (-0.00003954 + y * (0.00262573 + y * (-0.00054125 + y * (-0.00029333 + y * 0.00013558)))));
  return f * Math.cos(t) / Math.sqrt(x);
}
const STEP = 0.005, J0T = new Float64Array(Math.ceil(4000 / STEP) + 2);
for (let i = 0; i < J0T.length; i++) J0T[i] = j0x(i * STEP);
const j0 = x => { const f = x / STEP, i = f | 0; return i >= J0T.length - 1 ? j0x(x) : J0T[i] + (J0T[i + 1] - J0T[i]) * (f - i); };

// the pupil: each ray's place (sine of its angle to the film's axis point) and the wavefront there
function pupil(shift, rStop) {
  let lo = 0, hi = 14;                                      // the bundle's edge on the front glass
  for (let k = 0; k < 48; k++) { const mid = (lo + hi) / 2; if (CL.fromSubject(L, SUBJECT, shift, mid, rStop).blocked) hi = mid; else lo = mid; }
  const hEdge = lo, Rr = L.film - (L.surfaces[L.surfaces.length - 1].z - shift);
  const sphere = r => {
    const ox = r.last[0] - L.film, oy = r.last[1], b = ox * r.dir[0] + oy * r.dir[1], cc = ox * ox + oy * oy - Rr * Rr;
    const t = -b - Math.sqrt(b * b - cc);
    return { opl: r.opl + t, y: oy + r.dir[1] * t };
  };
  const a0 = sphere(CL.fromSubject(L, SUBJECT, shift, 1e-5, rStop));
  const rho = [], W = [];
  for (let i = 0; i < PUPIL; i++) {
    const r = CL.fromSubject(L, SUBJECT, shift, hEdge * (i + 0.5) / PUPIL, rStop);
    if (r.blocked) continue;
    const s = sphere(r);
    rho.push(Math.abs(s.y) / Rr);
    W.push(s.opl - a0.opl);
  }
  const m = rho.length, cw = new Float64Array(m), sw = new Float64Array(m);
  let area = 0, maxStep = 0;
  for (let i = 0; i < m; i++) {
    const dr = ((i + 1 < m ? rho[i + 1] : 2 * rho[i] - rho[i - 1]) - (i > 0 ? rho[i - 1] : 0)) / 2, w = rho[i] * dr;
    cw[i] = Math.cos(K * W[i]) * w; sw[i] = Math.sin(K * W[i]) * w; area += w;
    if (i) maxStep = Math.max(maxStep, Math.abs(K * (W[i] - W[i - 1])));
  }
  // all the light on the film, by Parseval; the largest phase step between neighbouring rays
  return { rho: Float64Array.from(rho), cw, sw, m, etot: 2 * Math.PI / (K * K) * area, maxStep, na: rho[m - 1] };
}
function intensity(P, r) {
  let re = 0, im = 0; const q = K * r;
  for (let i = 0; i < P.m; i++) { const J = j0(q * P.rho[i]); re += P.cw[i] * J; im += P.sw[i] * J; }
  return re * re + im * im;
}
const enc = (v, max) => Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.max(0, v) / max, GAMMA))));

const rStop2 = CL.stopAtF2(L);
const t0 = Date.now();
const spots = FOCUS.map(focus => {
  const shift = CL.extension(L, focus);
  return STOPS.map(N => {
    const P = pupil(shift, rStop2 * 2 / N);
    // the light on a fine grid out to the wide view's edge (finer near the centre), and the
    // encircled energy along it
    const rs = [];
    for (let r = 0; r < 0.04; r += 0.00025) rs.push(r);
    for (let r = 0.04; r <= REACH + 1e-9; r += 0.0005) rs.push(r);
    const I = rs.map(r => intensity(P, r)), EE = [0];
    for (let j = 1; j < rs.length; j++) EE.push(EE[j - 1] + Math.PI * (I[j] * rs[j] + I[j - 1] * rs[j - 1]) * (rs[j] - rs[j - 1]));
    const at = r => {                                         // encircled energy at radius r
      let j = 1; while (j < rs.length - 1 && rs[j] < r) j++;
      return EE[j - 1] + (EE[j] - EE[j - 1]) * (r - rs[j - 1]) / (rs[j] - rs[j - 1]);
    };
    let d80 = null;
    for (let j = 1; j < rs.length; j++) if (EE[j] >= 0.8 * P.etot) { d80 = 2 * (rs[j - 1] + (rs[j] - rs[j - 1]) * (0.8 * P.etot - EE[j - 1]) / (EE[j] - EE[j - 1])); break; }
    // the wide view: the light averaged over each ring
    const bin = WIDE.bin, wide = [];
    for (let k = 0; k < WIDE.n; k++) wide.push((at((k + 1) * bin) - at(k * bin)) / (Math.PI * (((k + 1) * bin) ** 2 - (k * bin) ** 2)));
    const centre = [];
    for (let j = 0; j < CENTRE.n; j++) centre.push(intensity(P, CENTRE.step * j));
    const wmax = Math.max(...wide), cmax = Math.max(...centre);
    const s = {
      w: Buffer.from(wide.map(v => enc(v, wmax))).toString('base64'),
      c: Buffer.from(centre.map(v => enc(v, cmax))).toString('base64'),
      d80: d80 === null ? null : Number(d80.toFixed(5))
    };
    const held = EE[EE.length - 1] / P.etot;
    console.log(`focus ${isFinite(focus) ? focus / 1000 + ' m' : '∞'}`.padEnd(12) + `f/${N}`.padEnd(6) +
      `d80 ${d80 === null ? '—' : (d80 * 1000).toFixed(1) + ' µm'}`.padEnd(16) + `light held ${(held * 100).toFixed(1)}%`.padEnd(20) +
      `phase step ${P.maxStep.toFixed(2)} rad`);
    if (held < 0.97 || held > 1.03) throw new Error('the light does not add up: ' + held);
    if (P.maxStep > 1) throw new Error('too few rays across the pupil: ' + P.maxStep);
    return s;
  });
});
const out = {
  subject: SUBJECT, lambda: LAMBDA, gamma: GAMMA,
  focus: FOCUS.map(f => isFinite(f) ? f : null), stops: STOPS,
  wide: WIDE, centre: CENTRE, spots
};
fs.writeFileSync(path.join(root, 'assets/img/teardown/lens-psf.json'), JSON.stringify(out));
console.log('wrote lens-psf.json in', ((Date.now() - t0) / 1000).toFixed(1), 's');
