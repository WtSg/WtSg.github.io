#!/usr/bin/env node
// A section through the lens to the film, for the page "The camera, taken apart"
// (assets/img/teardown/lens.json): the glass from optics.js, cut through the axis, with the barrel,
// the rings, the bayonet, the film and the pressure plate behind it. Drawn to the teardown skill's
// section conventions: solids cut by the plane hatched (the moving optical unit at 45°, the fixed
// barrel the other way), glass left clear with a pale tint, one centreline. Millimetres; the page
// draws the light through it with the same prescription and slides the optical unit for focus.
const fs = require('node:fs'), path = require('node:path');
const O = require('./optics.js');
const out = path.join(__dirname, '../../assets/img/teardown/lens.json');

const r1 = n => String(Number(n.toFixed(2)));
const pts = list => list.map(([z, h]) => r1(z) + ' ' + r1(-h)).join(' L');
const poly = (list, cls, extra = '') => `<path class="${cls}"${extra} d="M${pts(list)}Z"/>`;
const mirror = list => list.map(([z, h]) => [z, -h]).reverse();

// 45° hatching clipped to a polygon (even-odd), spacing in mm
function hatch(list, spacing, dir = 1) {
  const segs = [];
  const k = list.map(([z, h]) => h - dir * z);      // lines h = dir·z + c
  const lo = Math.min(...k), hi = Math.max(...k);
  for (let c = Math.ceil(lo / spacing) * spacing; c <= hi; c += spacing) {
    const xs = [];
    for (let i = 0; i < list.length; i++) {
      const [z0, h0] = list[i], [z1, h1] = list[(i + 1) % list.length];
      const f0 = h0 - dir * z0 - c, f1 = h1 - dir * z1 - c;
      if ((f0 < 0) !== (f1 < 0)) { const t = f0 / (f0 - f1); xs.push(z0 + (z1 - z0) * t); }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) segs.push([[xs[i], dir * xs[i] + c], [xs[i + 1], dir * xs[i + 1] + c]]);
  }
  return segs.map(([a, b]) => `M${r1(a[0])} ${r1(-a[1])}L${r1(b[0])} ${r1(-b[1])}`).join('');
}
// a cut solid of revolution: its upper and lower halves, outlined and hatched
function cut(upper, cls, spacing, dir) {
  return ['', 1].map((_, i) => {
    const half = i ? mirror(upper) : upper;
    return `<g class="${cls}">${poly(half, 'ls-cut')}<path class="ls-hatch" d="${hatch(half, spacing, dir)}"/></g>`;
  }).join('');
}

const S = O.surfaces, film = O.film;
const STOP = S[O.stopIndex].z;

// ---------- the optical unit: it moves as the lens is focused ----------
// the barrel holding the glass: stepped inside to each group's rim, lips front and back
const inner = [
  [2.4, 17.5], [40.2, 17.5], [40.2, 10.6], [39.0, 10.6], [39.0, 12.0], [21.9, 12.0], [21.9, 13.5],
  [7.6, 13.5], [7.6, 15.0], [4.0, 15.0], [4.0, 13.6], [2.4, 13.6]
];
const apertureRing = [[2.4, 17.5], [7.4, 17.5], [7.4, 20.2], [2.4, 20.2]];
let optics = cut(inner, 'ls-metal ls-unit', 1.05, 1) + cut(apertureRing, 'ls-metal ls-ring', 1.05, 1);
for (let i = 0; i < 6; i++) {  // the aperture ring's grip
  const z = 2.9 + i * 0.85;
  optics += `<path class="ls-detail" d="M${r1(z)} ${r1(-20.2)}L${r1(z)} ${r1(-19.4)}M${r1(z)} ${r1(20.2)}L${r1(z)} ${r1(19.4)}"/>`;
}
const glass = O.elements.map(el => {
  // the closed section: the front surface from -rim to +rim, then the back surface back down
  const front = [], back = [];
  const f = S[el.front], b = S[el.back], N = 40;
  for (let i = 0; i <= N; i++) { const h = -el.rim + 2 * el.rim * i / N; front.push([O.surfaceZ(f, h), h]); }
  for (let i = N; i >= 0; i--) { const h = -el.rim + 2 * el.rim * i / N; back.push([O.surfaceZ(b, h), h]); }
  return `<path class="ls-glass" data-el="${el.id}" d="M${pts([...front, ...back])}Z"/>`;
}).join('');
optics += `<g class="ls-glassgroup">${glass}</g>`;

// ---------- fixed: the barrel with the helicoid, the focus ring, the bayonet, the film ----------
const sleeve = [[8.2, 17.8], [38.8, 17.8], [38.8, 20.3], [8.2, 20.3]];
const ring = [[18.0, 20.3], [29.0, 20.3], [29.0, 23.2], [18.0, 23.2]];
const bayonet = [[36.4, 20.3], [38.8, 20.3], [38.8, 25.6], [36.4, 25.6]];
let fixed = cut(sleeve, 'ls-metal ls-fixed', 1.05, -1) + cut(ring, 'ls-metal ls-focus', 1.05, -1)
  + cut(bayonet, 'ls-metal ls-fixed', 1.05, -1);
// the helicoid's thread between the unit and the sleeve, and the focus ring's grip
for (let z = 9; z < 38.4; z += 1.1) fixed += `<path class="ls-thread" d="M${r1(z)} ${r1(-17.5)}L${r1(z + 0.55)} ${r1(-17.8)}M${r1(z)} ${r1(17.5)}L${r1(z + 0.55)} ${r1(17.8)}"/>`;
for (let z = 18.8; z < 28.6; z += 1.2) fixed += `<path class="ls-detail" d="M${r1(z)} ${r1(-23.2)}L${r1(z)} ${r1(-22.3)}M${r1(z)} ${r1(23.2)}L${r1(z)} ${r1(22.3)}"/>`;
// the film, across the frame's height, and the pressure plate behind it
const pp = [[film + 0.6, -14], [film + 1.8, -14], [film + 1.8, 14], [film + 0.6, 14]];
fixed += `<g class="ls-metal ls-body">${poly(pp, 'ls-cut')}<path class="ls-hatch" d="${hatch(pp, 1.0, 1)}"/></g>`;
fixed += `<path class="ls-film" d="M${r1(film)} ${r1(-12)}L${r1(film)} ${r1(12)}"/>`;
// the axis
const START = -12;
const axis = `<path class="ls-axis" d="M${START + 1} 0L${r1(film + 3.5)} 0"/>`;

// ---------- labels: placed once, above the drawing ----------
const label = (x, y, text, anchor, to) => `<g class="ls-label"><path d="M${r1(to[0])} ${r1(to[1])}L${r1(x)} ${r1(y + 1.1)}"/><text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${text}</text></g>`;
const L1 = O.elements[0], l1z = O.surfaceZ(S[L1.front], 9);
const labels = [
  label(1, -27.5, 'GLASS ELEMENTS', 'middle', [l1z + 1.2, -9]),
  label(STOP, -30.5, 'APERTURE BLADES', 'middle', [STOP, -12.6]),
  label(30, -27.5, 'FOCUS RING', 'start', [26, -23.2]),
  label(film, -16.5, 'FILM', 'middle', [film, -12.3])
].join('');

const data = {
  viewBox: `${START} -33 ${r1(film + 4.5 - START)} 63`,
  // the page slides this group forward to focus, and draws the aperture blades and the light
  optics, fixed: axis + fixed, labels,
  surfaces: S.map(s => ({z: +s.z.toFixed(4), R: s.R === null || !isFinite(s.R) ? null : +s.R.toFixed(4), n: s.n, clear: s.clear, stop: s.stop})),
  stop: {z: +STOP.toFixed(4), wall: 13.5},
  film: +film.toFixed(4), efl: +O.efl.toFixed(3),
  start: START
};
fs.writeFileSync(out, JSON.stringify(data));
console.log('lens', (JSON.stringify(data).length / 1024).toFixed(1) + ' KB', 'EFL', O.efl.toFixed(2), 'film at', film.toFixed(2), 'stop at', STOP.toFixed(2), 'flange to film', (film - 38.8).toFixed(2));
