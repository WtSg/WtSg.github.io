// A Leica M-style camera taken apart: the top cover and its dials lifted off, the viewfinder's
// optics, the rangefinder's mirror and roller lever above the body casting, the shutter drawn out
// of the back, the base plate, film cassette and take-up spool dropped out of the bottom (as such
// a camera is loaded), and the lens spread along its axis. An illustrative concept on the same
// layout and dimensions as model.js (the classic coincident-image rangefinder, not any one
// camera's construction; no maker's name or mark). Seen from behind, as the photographer holds
// it: the viewfinder at the left end, the rangefinder window at the right.
self.DrawingModels ??= {};
self.DrawingModels['rangefinder-exploded'] = (parameters, options) => {
  const G = TechnicalGeometry;
  const W = 138, D = 34, H = 80, PLATE = 52, R = 15;
  const FRONT = D / 2, BACK = -D / 2, Z = 68;
  const XF = -34, XR = 36, XL = 4, ZL = 28;
  const norm = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  const plateFrame = (x, y, z, normal) => ({origin: [x, y, z], xAxis: [normal[1], -normal[0], 0], yAxis: [normal[0], normal[1], 0], zAxis: [0, 0, 1]});
  const onY = (x, y, z) => ({origin: [x, y, z], ...G.along('y')});
  const ribs = (p, n, r, y0, y1, role = 'texture') => {          // grip lines round a ring on the lens axis
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      G.line(p, [XL + r * s, y0, ZL + r * c], [XL + r * s, y1, ZL + r * c], role);
    }
  };
  const LIFT = 66, UP = 104;

  // The top cover, see-through: its windows on the front, the eyepiece in the back, the
  // accessory shoe, the strap lugs at its ends
  const cover = G.part('cover', 'Top cover', [0, 0, LIFT]);
  cover.transparent = true;
  G.box(cover, [-W / 2 + 0.6, BACK + 0.6, PLATE], [W / 2 - 0.6, FRONT - 0.6, H], {radius: R - 0.6});
  const pane = (x, w, h) => G.polyline(cover, [[x - w / 2, FRONT - 0.65, Z - h / 2], [x + w / 2, FRONT - 0.65, Z - h / 2], [x + w / 2, FRONT - 0.65, Z + h / 2], [x - w / 2, FRONT - 0.65, Z + h / 2]], {closed: true, role: 'detail'});
  pane(XF, 25.5, 16.5);
  pane(-9, 12, 9);
  pane(XR, 14.5, 11.5);
  G.circle(cover, [XF, BACK + 0.55, Z], 9.5, [0, 1, 0], {segments: 72, role: 'detail'});
  G.box(cover, [-14, -9, H], [6, 9, H + 1.8]);
  for (const s of [-1, 1]) G.lathe(cover, [[0, 0], [0, 2.6], [4, 2.6], [4, 0]], {axis: 'x', at: [s > 0 ? W / 2 - 1 : -W / 2 - 3, 0, 64], segments: 36});

  // the dials, lifted off the cover
  const rewind = G.part('rewind', 'Rewind knob', [0, 0, UP]);
  G.lathe(rewind, [[0, 0], [0, 6], [2.2, 6], [2.2, 8.5], [6.5, 8.5], [6.5, 6], [9.5, 6], [9.5, 0]], {axis: 'z', at: [-52, 0, H], segments: 72});
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; G.line(rewind, [-52 + 8.55 * Math.cos(a), 8.55 * Math.sin(a), H + 2.6], [-52 + 8.55 * Math.cos(a), 8.55 * Math.sin(a), H + 6.2], 'texture'); }
  const speed = G.part('speed-dial', 'Shutter-speed dial', [0, 0, UP]);
  G.lathe(speed, [[0, 0], [0, 10], [4.6, 10], [4.6, 9.2], [5.4, 9.2], [5.4, 0]], {axis: 'z', at: [38, 2, H], segments: 96});
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; G.line(speed, [38 + 10.05 * Math.cos(a), 2 + 10.05 * Math.sin(a), H + 0.6], [38 + 10.05 * Math.cos(a), 2 + 10.05 * Math.sin(a), H + 4], 'texture'); }
  G.line(speed, [38, 2 - 6, H + 5.45], [38, 2 - 9, H + 5.45], 'detail');          // its index
  const advance = G.part('advance', 'Advance lever', [0, 0, UP]);
  G.lathe(advance, [[0, 0], [0, 4.6], [2.4, 4.6], [2.4, 3], [5.6, 3], [5.6, 0]], {axis: 'z', at: [53, -9, H], segments: 48});
  G.merge(advance, G.transform(G.extrude(G.piece(), [[56, -11.5], [32, -16], [31, -13.4], [56, -6.5]], {depth: 1.6}), {origin: [0, 0, H + 2.6]}));
  const release = G.part('release', 'Shutter release', [0, 0, UP + 16]);
  G.lathe(release, [[0, 0], [0, 4], [2.5, 4], [2.5, 2.6], [5.8, 2.6], [5.8, 0]], {axis: 'z', at: [53, 5, H], segments: 48});

  // The viewfinder: the windows' glass, the front lens, the frame-line window and its prism, the
  // half-silvered mirror and the eyepiece, each lifted with the rangefinder
  const FIND = 34;
  const glassPart = (id, name, explosion) => { const g = G.part(id, name, explosion); g.transparent = true; return g; };
  const glassPane = (p, x, w, h) => G.box(p, [x - w / 2, FRONT - 2, Z - h / 2], [x + w / 2, FRONT - 0.8, Z + h / 2]);
  const vfWin = glassPart('vf-window', 'Viewfinder window and lens', [0, 14, FIND]);
  glassPane(vfWin, XF, 24, 15);
  G.lathe(vfWin, [[0, 0], [0, 7.5], [2.4, 7.5], [2.4, 0]], {axis: 'y', at: [XF, FRONT - 7, Z], segments: 72});
  const frame = glassPart('frame-window', 'Frame-line window and prism', [0, 14, FIND]);
  glassPane(frame, -9, 11, 8);
  G.merge(frame, G.transform(G.box(G.piece(), [-4, -4, -4], [4, 4, 4]), {origin: [-9, 4, Z], xAxis: [Math.SQRT1_2, -Math.SQRT1_2, 0], yAxis: [Math.SQRT1_2, Math.SQRT1_2, 0], zAxis: [0, 0, 1]}));
  const rfWin = glassPart('rf-window', 'Rangefinder window', [0, 14, FIND]);
  glassPane(rfWin, XR, 13, 10);
  const splitter = glassPart('splitter', 'Half-silvered mirror', [0, 0, FIND]);
  G.merge(splitter, G.transform(G.box(G.piece(), [-7.5, -0.6, -6.5], [7.5, 0.6, 6.5]), plateFrame(XF, 0, Z, norm(1, -1))));
  const eye = glassPart('eyepiece', 'Eyepiece', [0, -12, FIND]);
  G.lathe(eye, [[0, 0], [0, 6.5], [2, 6.5], [2, 0]], {axis: 'y', at: [XF, BACK + 2, Z], segments: 72});

  // The rangefinder: the mirror, its lever, the roller lever and the roller, set for infinity
  const mirror = G.part('mirror', 'Rangefinder mirror', [0, 0, FIND + 8]);
  G.merge(mirror, G.transform(G.box(G.piece(), [-5.5, -0.7, -6], [5.5, 0.7, 6]), plateFrame(XR, 0, Z, norm(-1, 1))));
  const lever = G.part('lever', 'Mirror lever', [0, 0, FIND - 4]);
  G.lathe(lever, [[0, 0], [0, 1.4], [12, 1.4], [12, 0]], {axis: 'z', at: [XR, 0, 50], segments: 36});
  G.lathe(lever, [[0, 0], [0, 3], [2, 3], [2, 0]], {axis: 'z', at: [XR, 0, 50], segments: 36});
  {
    const ARM = [-10, 8], [ux, uy] = norm(ARM[0], ARM[1]), [px, py] = [-uy * 1.8, ux * 1.8];
    G.merge(lever, G.transform(G.extrude(G.piece(), [[px, py], [ARM[0] + px, ARM[1] + py], [ARM[0] - px, ARM[1] - py], [-px, -py]], {depth: 2}), {origin: [XR, 0, 50]}));
    G.lathe(lever, [[0, 0], [0, 0.8], [4.5, 0.8], [4.5, 0]], {axis: 'z', at: [XR + ARM[0], ARM[1], 45.5], segments: 24});
  }
  const rocker = G.part('rocker', 'Roller lever', [0, 0, 16]);
  G.merge(rocker, G.transform(G.extrude(G.piece(), [[-12, -2.2], [11.6, -2.2], [11.6, 2.2], [-12, 2.2]], {depth: 1.5, holes: [[[5.6, -1.1], [9.6, -1.1], [9.6, 1.1], [5.6, 1.1]]]}), {origin: [18, 8, 46.5]}));
  G.lathe(rocker, [[0, 0], [0, 1.6], [8.5, 1.6], [8.5, 0]], {axis: 'z', at: [18, 8, 38], segments: 32});
  G.box(rocker, [4.8, 7, 43], [5.6, 9, 46.5]);
  G.box(rocker, [10.4, 7, 43], [11.2, 9, 46.5]);
  const roller = G.part('roller', 'Roller', [0, 0, 11]);
  G.lathe(roller, [[0, 0], [0, 2.5], [4.4, 2.5], [4.4, 0]], {axis: 'x', at: [5.8, 8, 43], segments: 36});

  // The body casting, with the lens mount
  const body = G.part('body', 'Body casting');
  G.box(body, [-W / 2, BACK, 0], [W / 2, FRONT, PLATE], {radius: R});
  G.circle(body, [XL, FRONT + 0.05, ZL], 25.5, [0, 1, 0], {segments: 96});
  G.circle(body, [XL, FRONT + 0.05, ZL], 20, [0, 1, 0], {segments: 96, role: 'detail'});
  G.circle(body, [XL + 31, FRONT + 0.05, ZL - 14], 3.2, [0, 1, 0], {segments: 36, role: 'detail'});   // the lens release

  // The shutter: two cloth curtains on their drums, drawn out of the back
  const shutter = G.part('shutter', 'Focal-plane shutter', [0, -78, 6]);
  for (const x of [-25, 25]) G.lathe(shutter, [[0, 0], [0, 4], [38, 4], [38, 0]], {axis: 'z', at: [x, -9, 7], segments: 48});
  G.box(shutter, [-25, -5.6, 8], [25, -5, 44]);
  for (let i = 1; i < 6; i++) G.line(shutter, [-25 + i * 50 / 6, -5.62, 8], [-25 + i * 50 / 6, -5.62, 44], 'texture');

  // Out of the bottom: the base plate with its locking key, the film cassette, the take-up spool
  const base = G.part('base', 'Base plate', [0, 0, -62]);
  G.box(base, [-W / 2 + 0.6, BACK + 0.6, -2.4], [W / 2 - 0.6, FRONT - 0.6, 0], {radius: R - 0.6});
  G.lathe(base, [[0, 0], [0, 6], [1.4, 6], [1.4, 0]], {axis: 'z', at: [-44, 0, -3.8], segments: 48});
  G.box(base, [-49, -1.2, -5.6], [-39, 1.2, -3.8]);
  G.circle(base, [XL, 0, -2.45], 3, [0, 0, 1], {segments: 36, role: 'detail'});
  const cassette = G.part('cassette', 'Film cassette', [0, 0, -40]);
  G.lathe(cassette, [[0, 0], [0, 3.5], [1.6, 3.5], [1.6, 12.4], [37.4, 12.4], [37.4, 3.5], [40.6, 3.5], [40.6, 0]], {axis: 'z', at: [-50, -2, 4.2], segments: 72});
  G.box(cassette, [-46, 8.5, 5.8], [-36.5, 12.4, 41.6]);
  const spool = G.part('spool', 'Take-up spool', [0, 0, -40]);
  G.lathe(spool, [[0, 0], [0, 9], [1.6, 9], [1.6, 6.4], [36, 6.4], [36, 9], [37.6, 9], [37.6, 0]], {axis: 'z', at: [47, -2, 6], segments: 72});
  for (const a of [0.4, 2.5, 4.6]) G.line(spool, [47 + 6.45 * Math.cos(a), -2 + 6.45 * Math.sin(a), 12], [47 + 6.45 * Math.cos(a), -2 + 6.45 * Math.sin(a), 36], 'detail');

  // The lens, set at infinity and spread along its axis: the cam, the bayonet, the helicoid,
  // the focus ring with its tab, the aperture ring, the optical unit
  const STEP = 21;
  const cam = G.part('cam', 'Focusing cam', [0, STEP * 2, 0]);
  G.lathe(cam, [[0, 12], [0, 19.5], [3, 19.5], [3, 12]], {axis: 'y', at: [XL, 10.5, ZL], segments: 120});
  const bayonet = G.part('bayonet', 'Lens bayonet', [0, STEP * 3, 0]);
  G.lathe(bayonet, [[0, 11.5], [0, 25], [2.5, 25], [2.5, 22.5], [4.5, 22.5], [4.5, 20], [2.5, 20], [2.5, 11.5]], {axis: 'y', at: [XL, FRONT, ZL], segments: 120});
  for (const a of [0.3, 2.4, 4.5]) G.lathe(bayonet, [[0, 20.2], [0, 23.4], [2.6, 23.4], [2.6, 20.2]], {axis: 'y', at: [XL, FRONT - 2.6, ZL], start: a, end: a + 0.75, segments: 120});
  G.line(bayonet, [XL, FRONT + 2.7, ZL + 22.55], [XL, FRONT + 4.4, ZL + 22.55], 'detail');
  const helicoid = G.part('helicoid', 'Helicoid', [0, STEP * 4, 0]);
  G.lathe(helicoid, [[0, 19], [0, 20.4], [9, 20.4], [9, 19]], {axis: 'y', at: [XL, FRONT + 4.5, ZL], segments: 120});
  G.merge(helicoid, G.transform(G.helix(G.piece(), {x0: 0.6, x1: 8.4, radius: 20.45, pitch: 1.6, role: 'texture'}), onY(XL, FRONT + 4.5, ZL)));
  const ring = G.part('focus-ring', 'Focus ring and tab', [0, STEP * 5, 0]);
  G.lathe(ring, [[4.6, 20.5], [4.6, 23], [7, 23], [7, 24], [13, 24], [13, 20.5]], {axis: 'y', at: [XL, FRONT, ZL], segments: 120});
  ribs(ring, 30, 24.05, FRONT + 8, FRONT + 12);
  {
    const a = -2.35, u = [Math.sin(a), 0, Math.cos(a)], w = [Math.cos(a), 0, -Math.sin(a)];   // the tab, below and to the left
    G.merge(ring, G.transform(G.extrude(G.piece(), [[23.5, -3.4], [29, -2.4], [29.6, 0], [29, 2.4], [23.5, 3.4]], {depth: 5}), {origin: [XL, FRONT + 6.5, ZL], xAxis: u, yAxis: w, zAxis: [0, 1, 0]}));
  }
  for (const d of [0, 1 / 3, 1 / 2, 1 / 1.5, 1, 1 / 0.7]) {
    const a = -d * 70 * Math.PI / 180;
    G.line(ring, [XL + 23.05 * Math.sin(a), FRONT + 4.7, ZL + 23.05 * Math.cos(a)], [XL + 23.05 * Math.sin(a), FRONT + (d ? 6.1 : 6.9), ZL + 23.05 * Math.cos(a)], 'detail');
  }
  const aperture = G.part('aperture', 'Aperture ring', [0, STEP * 6.2, 0]);
  G.lathe(aperture, [[22, 20.8], [22, 22.6], [27, 22.6], [27, 20.8]], {axis: 'y', at: [XL, FRONT, ZL], segments: 120});
  ribs(aperture, 24, 22.65, FRONT + 22.6, FRONT + 26.4);
  const optics = G.part('optics', 'Optical unit', [0, STEP * 7.6, 0]);
  G.lathe(optics, [[13, 0], [13, 20], [21.8, 20], [21.8, 19.4], [27.2, 19.4], [27.2, 21], [33, 21], [33, 20], [34, 20], [34, 0]], {axis: 'y', at: [XL, FRONT, ZL], segments: 120});
  G.circle(optics, [XL, FRONT + 34.05, ZL], 15, [0, 1, 0], {role: 'detail', segments: 96});
  G.circle(optics, [XL, FRONT + 34.05, ZL], 17.5, [0, 1, 0], {role: 'detail', segments: 96});

  const parts = [cover, rewind, speed, advance, release, vfWin, frame, rfWin, splitter, eye, mirror, lever, rocker, roller, body, shutter, base, cassette, spool, cam, bayonet, helicoid, ring, aperture, optics];
  const camera = options.camera ?? {azimuth: -42, elevation: 26, roll: 0};
  return TechnicalProjection.render(parts, {...options, camera});
};
