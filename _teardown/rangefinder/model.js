// How a rangefinder focuses: the coincident-image rangefinder of a Leica M-style camera, as an
// illustrative concept (the classic swinging-mirror layout, not any one camera's construction,
// no maker's name or mark). Millimetres; x runs across the camera, y towards the subject, z up.
// One parameter, the distance the lens is focused at (in dioptres, 1 / metres), sets the mirror,
// the lever, the roller, the focusing cam and the light paths together. Angles and travel are
// drawn five times their real size, or they would not show on paper.
self.DrawingModels ??= {};
self.DrawingModels.rangefinder = (parameters, options) => {
  const G = TechnicalGeometry;
  const v = parameters.dioptres;
  if (!Number.isFinite(v) || v < 0 || v > 1.4286 + 1e-9) throw Error('Focus must be from infinity (0) to 0.7 m (1.43)');

  const W = 138, D = 34, H = 80, R = 15;          // the body, its rounded ends
  const FRONT = D / 2, BACK = -D / 2, PLATE = 52; // the top plate begins at PLATE
  const Z = 68;                                    // the viewfinder's axis
  const XF = 34, XR = -36, BASE = XF - XR;         // the viewfinder window, the rangefinder window
  const XL = 0, ZL = 28;                           // the lens axis
  const K = 5, BASE_REAL = 0.069;                  // angles drawn K times their size
  const REACH = 140;                               // how far in front the light paths are drawn
  const LIFT = 52, DROP = 52;                      // how far the cover rises and the body falls

  // Where the subject in focus stands: on the viewfinder's axis, at the distance the rangefinder
  // triangle (base and parallax angle, both drawn K times) puts it.
  const alpha = K * Math.atan(BASE_REAL * v);
  const Ys = alpha > 1e-9 ? BASE / Math.tan(alpha) : Infinity;
  const norm = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  // The mirror's face bisects the light coming in from the subject and going out to the
  // half-silvered mirror (along +x): its normal is out − in.
  const din = Ys === Infinity ? [0, -1] : norm(XR - XF, -Ys);
  const n = norm(1 - din[0], -din[1]);
  const theta = Math.atan2(n[1], n[0]), phi = theta - Math.PI / 4;   // phi = 0 at infinity
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const plateFrame = (x, y, z, normal) => ({origin: [x, y, z], xAxis: [normal[1], -normal[0], 0], yAxis: [normal[0], normal[1], 0], zAxis: [0, 0, 1]});

  // The top cover, lifted off: rounded ends, the three windows on its front, dials on top
  const cover = G.part('cover', 'Top cover', [0, 0, LIFT]);
  G.box(cover, [-W / 2, BACK, PLATE], [W / 2, FRONT, H], {radius: R});
  const win = (x, w, h) => {
    const y = FRONT + 0.05, z0 = Z - h / 2, z1 = Z + h / 2, x0 = x - w / 2, x1 = x + w / 2;
    G.polyline(cover, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], {closed: true});
  };
  win(XF, 22, 14);       // the viewfinder window
  win(9, 13, 8);         // the frame-line window
  win(XR, 13, 10);       // the rangefinder window
  const knob = (x, y, r, h) => { const k = G.piece(); G.lathe(k, [[0, 0], [0, r], [h, r], [h, 0]], {axis: 'z', at: [x, y, H], segments: 72}); G.merge(cover, k); };
  knob(-50, 1, 9, 4.5);  // the speed dial
  knob(-60, 7, 3, 3);    // the release
  knob(53, 0, 7, 4.5);   // the rewind knob

  // The body, dropped away from the lens and the rangefinder
  const body = G.part('body', 'Body', [0, 0, -DROP]);
  G.box(body, [-W / 2, BACK, 0], [W / 2, FRONT, PLATE - 1], {radius: R});
  G.circle(body, [XL, FRONT + 0.05, ZL], 25, [0, 1, 0], {segments: 96});

  // The viewfinder: front lens behind its window, the half-silvered mirror, the eyepiece
  const front = G.part('front-lens', 'Viewfinder front lens');
  G.lathe(front, [[0, 0], [0, 7.5], [2.4, 7.5], [2.4, 0]], {axis: 'y', at: [XF, FRONT - 6, Z], segments: 72});
  front.transparent = true;
  const splitter = G.part('splitter', 'Half-silvered mirror');
  const sp = G.piece();
  G.box(sp, [-7.5, -0.6, -6.5], [7.5, 0.6, 6.5]);
  G.merge(splitter, G.transform(sp, plateFrame(XF, 0, Z, norm(1, 1))));
  splitter.transparent = true;
  const eye = G.part('eyepiece', 'Eyepiece');
  G.lathe(eye, [[0, 6], [0, 8.5], [6, 8.5], [6, 6]], {axis: 'y', at: [XF, BACK - 6, Z], segments: 72});
  // the two windows' glass, left where the cover held them
  const glassPane = (id, name, x, w, h) => {
    const g = G.part(id, name);
    G.box(g, [x - w / 2, FRONT - 1.2, Z - h / 2], [x + w / 2, FRONT, Z + h / 2]);
    g.transparent = true;
    return g;
  };
  const vfWin = glassPane('vf-window', 'Viewfinder window', XF, 22, 14);
  const rfWin = glassPane('rf-window', 'Rangefinder window', XR, 13, 10);

  // The rangefinder: the mirror on its pivot, turned by the lever, whose roller rides on the
  // focusing cam at the back of the lens
  const mirror = G.part('mirror', 'Rangefinder mirror');
  const mp = G.piece();
  G.box(mp, [-5.5, -0.7, -6], [5.5, 0.7, 6]);
  G.merge(mirror, G.transform(mp, plateFrame(XR, 0, Z, n)));

  const ROLL_R = 2.5, ROLL_Z = 45, YR0 = 11;        // the roller, at infinity
  const lever = G.part('lever', 'Mirror lever and pivot');
  const lv = G.piece();
  G.lathe(lv, [[0, 0], [0, 1.4], [Z - 6.2 - 49, 1.4], [Z - 6.2 - 49, 0]], {axis: 'z', at: [0, 0, 49], segments: 48});   // the pivot, up to the mirror
  const arm = [XL - XR, YR0], [ux, uy] = norm(arm[0], arm[1]), [px, py] = [-uy * 2, ux * 2];
  G.merge(lv, G.transform(G.extrude(G.piece(), [[-ux * 2 + px, -uy * 2 + py], [arm[0] + px, arm[1] + py], [arm[0] - px, arm[1] - py], [-ux * 2 - px, -uy * 2 - py]], {depth: 2.5}), {origin: [0, 0, 49]}));
  G.box(lv, [arm[0] - 1.5, arm[1] - 1.5, ROLL_Z + 1], [arm[0] + 1.5, arm[1] + 1.5, 49.2]);   // the post down to the roller
  G.merge(lever, G.transform(lv, {origin: [XR, 0, 0], xAxis: [Math.cos(phi), Math.sin(phi), 0], yAxis: [-Math.sin(phi), Math.cos(phi), 0], zAxis: [0, 0, 1]}));

  const [rx, ry] = rot(arm[0], arm[1], phi), RX = XR + rx, RY = ry;
  const roller = G.part('roller', 'Roller');
  G.lathe(roller, [[0, 0], [0, ROLL_R], [5, ROLL_R], [5, 0]], {axis: 'x', at: [RX - 2.5, RY, ROLL_Z], segments: 48});

  // The lens, and its focusing cam: a ring that moves as the lens is focused, here exactly as
  // far as the lever needs to turn the mirror (arm × angle)
  const lens = G.part('lens', 'Lens');
  G.lathe(lens, [[-22, 0], [-22, 11.5], [0, 11.5], [0, 25], [3, 25], [3, 23], [36, 23], [36, 19], [37, 19], [37, 0]], {axis: 'y', at: [XL, FRONT, ZL], segments: 96});
  // the roller rides on the cam's back face: as the lens is focused closer the cam moves back
  // and pushes the roller with it
  const camFace = RY + ROLL_R;
  const cam = G.part('cam', 'Focusing cam');
  G.lathe(cam, [[0, 12], [0, 19], [3, 19], [3, 12]], {axis: 'y', at: [XL, camFace, ZL], segments: 96});

  // The light: from the subject through the viewfinder window straight to the eye, and through
  // the rangefinder window to the mirror, across to the half-silvered mirror and into the eye
  const light = G.part('light', 'Light from the subject');
  const far = FRONT + REACH;
  const S = Ys <= far ? [XF, Ys, Z] : null;
  const M = [XR, 0, Z], P = [XF, 0, Z], E = [XF, BACK - 14, Z];
  const mainStart = S ?? [XF, far, Z];
  const rfStart = S ?? [XR - din[0] * (far / -din[1]), far, Z];
  G.line(light, mainStart, P, 'detail');
  G.line(light, P, E, 'detail');
  G.line(light, rfStart, M, 'detail');
  G.line(light, M, P, 'detail');
  if (S) {
    // the subject, where the two paths meet
    G.line(light, [S[0] - 3, S[1], S[2]], [S[0] + 3, S[1], S[2]], 'detail');
    G.line(light, [S[0], S[1], S[2] - 3], [S[0], S[1], S[2] + 3], 'detail');
  }

  // Every setting fits the page the same way: a fixed frame of hidden trails round all of them
  const frame = [[-W / 2, BACK - 16, -DROP], [W / 2, FRONT + REACH + 4, Z + 10]];
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [frame[i & 1][0], frame[(i >> 1) & 1][1], frame[(i >> 2) & 1][2]]);
  const trails = corners.map(c => ({a: c, b: [c[0] + 0.01, c[1], c[2]], role: 'texture'}));

  // the top cover is left off this drawing, so the light can be followed; its windows stay
  const parts = [body, vfWin, rfWin, front, splitter, eye, mirror, lever, roller, lens, cam, light];
  void cover;
  const result = TechnicalProjection.render(parts, {...options, camera: {azimuth: -100, elevation: 40, roll: 0}, trails});
  return {...result, meta: {Ys, phi, camTravel: camFace - (rot(arm[0], arm[1], 0)[1] + ROLL_R)}};
};
