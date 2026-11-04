// A Leica M-style camera taken apart: the top cover and its dials lifted off, the viewfinder's
// optics, the rangefinder's mirror and roller lever above the body casting, the shutter drawn out
// of the back, the base plate, film cassette and take-up spool dropped out of the bottom (as such
// a camera is loaded), and the lens spread along its axis. An illustrative concept on the same
// layout and dimensions as model.js (the classic coincident-image rangefinder, not any one
// camera's construction; no maker's name or mark). Seen from behind, as the photographer holds
// it: the viewfinder at the left end, the rangefinder window at the right. Needs optics.js loaded
// first (self.LensOptics), for the lens's glass.
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

  // The lens, set at infinity and spread along its axis, built to the same section as the light's
  // drawing (lens-section.cjs) and holding the same glass (optics.js): the focusing cam, the
  // bayonet, the helicoid's sleeve, the focus ring with its tab, the optical unit that slides in
  // the sleeve, the aperture ring; then, out of the front of the unit in their order, the rear
  // element, the rear cemented pair, the aperture blades, the front pair and the front element.
  const O = self.LensOptics, FLANGE = 38.8;                 // the lens's flange, in the glass's own axis coordinates
  const ax = z => FLANGE - z;                               // from the glass's axis (front vertex 0) to ours
  const lensAt = [XL, FRONT, ZL];
  const cam = G.part('cam', 'Focusing cam', [0, 20, 0]);
  G.lathe(cam, [[0, 12], [0, 19.5], [3, 19.5], [3, 12]], {axis: 'y', at: [XL, 10.5, ZL], segments: 120});
  const bayonet = G.part('bayonet', 'Lens bayonet', [0, 26, 0]);
  G.lathe(bayonet, [[0, 20.3], [0, 25.6], [2.4, 25.6], [2.4, 20.3]], {axis: 'y', at: lensAt, segments: 120});
  for (const a of [0.3, 2.4, 4.5]) G.lathe(bayonet, [[0, 20.6], [0, 23.4], [2.6, 23.4], [2.6, 20.6]], {axis: 'y', at: [XL, FRONT - 2.6, ZL], start: a, end: a + 0.75, segments: 120});
  G.line(bayonet, [XL, FRONT + 0.4, ZL + 25.65], [XL, FRONT + 2, ZL + 25.65], 'detail');
  const helicoid = G.part('helicoid', 'Helicoid', [0, 32, 0]);
  G.lathe(helicoid, [[0, 17.8], [0, 20.3], [30.6, 20.3], [30.6, 17.8]], {axis: 'y', at: lensAt, segments: 120});
  G.merge(helicoid, G.transform(G.helix(G.piece(), {x0: 0.8, x1: 29.8, radius: 20.35, pitch: 1.1, role: 'texture'}), onY(XL, FRONT, ZL)));
  const ring = G.part('focus-ring', 'Focus ring and tab', [0, 56, 0]);
  G.lathe(ring, [[ax(29), 20.3], [ax(29), 23.2], [ax(18), 23.2], [ax(18), 20.3]], {axis: 'y', at: lensAt, segments: 120});
  ribs(ring, 30, 23.25, FRONT + ax(26.5), FRONT + ax(19.2));
  {
    const a = -2.35, u = [Math.sin(a), 0, Math.cos(a)], w = [Math.cos(a), 0, -Math.sin(a)];   // the tab, below and to the left
    G.merge(ring, G.transform(G.extrude(G.piece(), [[22.8, -3.4], [28.3, -2.4], [28.9, 0], [28.3, 2.4], [22.8, 3.4]], {depth: 5}), {origin: [XL, FRONT + ax(23.5) - 2.5, ZL], xAxis: u, yAxis: w, zAxis: [0, 1, 0]}));
  }
  for (const d of [0, 1 / 3, 1 / 2, 1 / 1.5, 1, 1 / 0.7]) {
    const a = -d * 70 * Math.PI / 180;
    G.line(ring, [XL + 23.25 * Math.sin(a), FRONT + ax(29) + 0.2, ZL + 23.25 * Math.cos(a)], [XL + 23.25 * Math.sin(a), FRONT + ax(29) + (d ? 1.4 : 2.2), ZL + 23.25 * Math.cos(a)], 'detail');
  }
  // the optical unit: the barrel holding the glass, stepped inside to each group's rim
  const optics = G.part('optics', 'Optical unit', [0, 82, 0]);
  G.lathe(optics, [[2.4, 17.5], [40.2, 17.5], [40.2, 10.6], [39.0, 10.6], [39.0, 12.0], [21.9, 12.0], [21.9, 13.5], [7.6, 13.5], [7.6, 15.0], [4.0, 15.0], [4.0, 13.6], [2.4, 13.6]].map(([z, r]) => [ax(z), r]), {axis: 'y', at: lensAt, segments: 120});
  const aperture = G.part('aperture', 'Aperture ring', [0, 92, 0]);
  G.lathe(aperture, [[ax(7.4), 17.5], [ax(7.4), 20.2], [ax(2.4), 20.2], [ax(2.4), 17.5]], {axis: 'y', at: lensAt, segments: 120});
  ribs(aperture, 24, 20.25, FRONT + ax(6.6), FRONT + ax(3.2));
  // the glass, from optics.js: four groups (two cemented pairs), and the blades between them
  const glassGroup = (id, name, els, dy) => {
    const g = G.part(id, name, [0, dy, 0]);
    for (const e of els) G.lathe(g, O.profile(O.elements.find(x => x.id === e), 14).map(([z, h]) => [ax(z), h]), {axis: 'y', at: lensAt, segments: 72, creaseAngle: 30});
    g.transparent = true;
    return g;
  };
  const gRear = glassGroup('glass-rear', 'Rear element', ['l6'], 128);
  const gRearPair = glassGroup('glass-rear-pair', 'Rear cemented pair', ['l4', 'l5'], 146);
  const iris = G.part('iris', 'Aperture blades', [0, 162, 0]);
  {
    const zs = O.surfaces[O.stopIndex].z, y = FRONT + ax(zs), open = 7.37, wall = 13.4;
    G.lathe(iris, [[ax(zs) - 0.25, open], [ax(zs) - 0.25, wall], [ax(zs) + 0.25, wall], [ax(zs) + 0.25, open]], {axis: 'y', at: lensAt, segments: 96});
    for (let i = 0; i < 10; i++) {      // the blades' edges, curving in from the wall to the opening
      const pts = [];
      for (let k = 0; k <= 8; k++) { const r = wall - (wall - open) * k / 8, t = i / 10 * Math.PI * 2 + k / 8 * 0.9; pts.push([XL + r * Math.cos(t), y - 0.26, ZL + r * Math.sin(t)]); }
      G.polyline(iris, pts, {role: 'detail'});
    }
  }
  const gFrontPair = glassGroup('glass-front-pair', 'Front cemented pair', ['l2', 'l3'], 176);
  const gFront = glassGroup('glass-front', 'Front element', ['l1'], 196);

  const parts = [cover, rewind, speed, advance, release, vfWin, frame, rfWin, splitter, eye, mirror, lever, rocker, roller, body, shutter, base, cassette, spool, cam, bayonet, helicoid, ring, optics, aperture, gRear, gRearPair, iris, gFrontPair, gFront];
  const camera = options.camera ?? {azimuth: -42, elevation: 26, roll: 0};
  return TechnicalProjection.render(parts, {...options, camera});
};
