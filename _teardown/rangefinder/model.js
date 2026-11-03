// How a rangefinder focuses: the coincident-image rangefinder of a Leica M-style camera, as an
// illustrative concept (the classic swinging-mirror layout, not any one camera's construction,
// no maker's name or mark). Millimetres; x runs across the camera from the photographer's left
// to right, y towards the subject, z up. Seen from behind, as the photographer holds it: the
// viewfinder window and the eyepiece at the left end, the rangefinder window at the right.
// One parameter, the distance the lens is focused at (in dioptres, 1 / metres), sets the lens,
// its focus ring and cam, the roller, the levers, the mirror and the rangefinder's line of sight
// together. A subject stands 1 m away; the two lines of sight meet on it when the lens is focused
// there. Angles are drawn six times their real size, or they would not show on paper.
self.DrawingModels ??= {};
self.DrawingModels.rangefinder = (parameters, options) => {
  const G = TechnicalGeometry;
  const v = parameters.dioptres;
  if (!Number.isFinite(v) || v < 0 || v > 1.4286 + 1e-9) throw Error('Focus must be from infinity (0) to 0.7 m (1.43)');

  const W = 138, D = 34, H = 80, PLATE = 52, R = 15; // the body; its top cover from PLATE up
  const FRONT = D / 2, BACK = -D / 2;
  const Z = 68;                                    // the finder's axis
  const XF = -34, XR = 36, BASE = XR - XF;         // the viewfinder window (left), the rangefinder window (right)
  const XL = 4, ZL = 28;                           // the lens axis
  const K = 9, BASE_REAL = 0.069;                  // parallax angles drawn K times their size
  const SUBJECT = 1;                               // the subject stands 1 m away
  const REACH = 112;                               // how far in front the light is drawn
  const far = FRONT + REACH;

  // How far in front of the finder (y = 0) the two lines of sight meet for a distance d (dioptres)
  const sightAt = d => { const a = K * Math.atan(BASE_REAL * d); return a > 1e-9 ? BASE / Math.tan(a) : Infinity; };
  const Ys = sightAt(v), Yt = sightAt(SUBJECT);
  const norm = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const turnZ = (a, x, y) => ({origin: [x, y, 0], xAxis: [Math.cos(a), Math.sin(a), 0], yAxis: [-Math.sin(a), Math.cos(a), 0], zAxis: [0, 0, 1]});
  const plateFrame = (x, y, z, normal) => ({origin: [x, y, z], xAxis: [normal[1], -normal[0], 0], yAxis: [normal[0], normal[1], 0], zAxis: [0, 0, 1]});

  // The mirror's face bisects the light coming in along the line of sight and the light going out
  // across to the half-silvered mirror (along -x): its normal is out - in. It turns
  // anticlockwise, seen from above, as the lens is focused closer.
  const din = Ys === Infinity ? [0, -1] : norm(XR - XF, -Ys);
  const n = norm(-1 - din[0], -din[1]);
  const phi = Math.atan2(n[1], n[0]) - Math.atan2(1, -1);           // 0 at infinity

  // The linkage: the mirror's lever carries a pin; the pin rides in a slot in the roller lever,
  // a rocker on a fixed post, whose other end holds the roller against the lens's cam. As the
  // lens is focused closer its cam moves forward, the roller follows it (a spring keeps it on),
  // the rocker tips and the pin turns the mirror.
  const PIVOT_Z = 50, ARM = [-10, 8];             // the mirror lever, from its pivot to its pin
  const Q = [XR - 18, 8], ROCK_Z = 46.5, L1 = 10; // the rocker's post, its plate, its arm to the roller
  const ROLL_R = 2.5, ROLL_Z = 43;
  const pinAt = a => { const [x, y] = rot(ARM[0], ARM[1], a); return [XR + x, y]; };
  const rollerAt = a => {
    const [px, py] = pinAt(a), psi = Math.atan2(py - Q[1], px - Q[0]);
    return {psi, x: Q[0] - L1 * Math.cos(psi), y: Q[1] - L1 * Math.sin(psi)};
  };
  const pin = pinAt(phi), roll = rollerAt(phi), roll0 = rollerAt(0);
  const camFace = roll.y + ROLL_R, EXT = roll.y - roll0.y;           // the lens moves out with its cam

  // The body and its top cover, drawn see-through: rounded ends, the three windows on the front
  // of the cover, the dials on top (the rewind knob at the left end; the shutter-speed dial, the
  // release and the advance lever at the right), the lens mount
  const body = G.part('body', 'Body, see-through');
  body.transparent = true;
  G.box(body, [-W / 2, BACK, 0], [W / 2, FRONT, PLATE], {radius: R});
  G.box(body, [-W / 2 + 0.6, BACK + 0.6, PLATE], [W / 2 - 0.6, FRONT - 0.6, H], {radius: R - 0.6});
  G.circle(body, [XL, FRONT + 0.05, ZL], 25.5, [0, 1, 0], {segments: 96});
  const pane = (x, w, h, z = Z) => G.polyline(body, [[x - w / 2, FRONT - 0.5, z - h / 2], [x + w / 2, FRONT - 0.5, z - h / 2], [x + w / 2, FRONT - 0.5, z + h / 2], [x - w / 2, FRONT - 0.5, z + h / 2]], {closed: true, role: 'detail'});
  pane(XF, 25.5, 16.5);
  pane(-9, 12, 9);                                 // the frame-line window, frosted
  pane(XR, 14.5, 11.5);
  const dial = (x, y, profile) => G.lathe(body, profile, {axis: 'z', at: [x, y, H - 0.6], segments: 72});
  dial(-52, 0, [[0, 0], [0, 8.5], [3, 8.5], [3, 6], [9, 6], [9, 0]]);              // the rewind knob
  dial(38, 2, [[0, 0], [0, 10], [5, 10], [5, 0]]);                                 // the shutter-speed dial
  dial(53, 4, [[0, 0], [0, 4], [2.5, 4], [2.5, 2.6], [5.5, 2.6], [5.5, 0]]);       // the release
  dial(53, -9, [[0, 0], [0, 4.5], [2.4, 4.5], [2.4, 0]]);                          // the advance lever's hub
  G.merge(body, G.transform(G.extrude(G.piece(), [[56, -11.5], [32, -16], [31, -13.4], [56, -6.5]], {depth: 1.6}), {origin: [0, 0, H + 1.6]}));   // the advance lever
  G.box(body, [-14, -9, H - 0.6], [6, 9, H + 1.2]);                                // the accessory shoe

  // The viewfinder: its window, the front lens, the half-silvered mirror, the eyepiece
  const glassPane = (id, name, x, w, h) => {
    const g = G.part(id, name);
    G.box(g, [x - w / 2, FRONT - 1.2, Z - h / 2], [x + w / 2, FRONT, Z + h / 2]);
    g.transparent = true;
    return g;
  };
  const vfWin = glassPane('vf-window', 'Viewfinder window and lens', XF, 24, 15);
  const rfWin = glassPane('rf-window', 'Rangefinder window', XR, 13, 10);
  G.lathe(vfWin, [[0, 0], [0, 7.5], [2.4, 7.5], [2.4, 0]], {axis: 'y', at: [XF, FRONT - 7, Z], segments: 72});   // its front lens
  const splitter = G.part('splitter', 'Half-silvered mirror');
  G.merge(splitter, G.transform(G.box(G.piece(), [-7.5, -0.6, -6.5], [7.5, 0.6, 6.5]), plateFrame(XF, 0, Z, norm(1, -1))));
  splitter.transparent = true;
  const eye = G.part('eyepiece', 'Eyepiece');
  G.lathe(eye, [[0, 6], [0, 8.5], [5, 8.5], [5, 9.5], [7, 9.5], [7, 6]], {axis: 'y', at: [XF, BACK - 7, Z], segments: 72});

  // The rangefinder mirror on its pivot
  const mirror = G.part('mirror', 'Rangefinder mirror');
  G.merge(mirror, G.transform(G.box(G.piece(), [-5.5, -0.7, -6], [5.5, 0.7, 6]), plateFrame(XR, 0, Z, n)));

  // its lever: the pivot up to the mirror, an arm, the pin down through the rocker's slot
  const lever = G.part('lever', 'Mirror lever');
  const lv = G.piece();
  G.lathe(lv, [[0, 0], [0, 1.4], [Z - 6 - PIVOT_Z, 1.4], [Z - 6 - PIVOT_Z, 0]], {axis: 'z', at: [0, 0, PIVOT_Z], segments: 48});
  G.lathe(lv, [[0, 0], [0, 3], [2, 3], [2, 0]], {axis: 'z', at: [0, 0, PIVOT_Z], segments: 48});
  {
    const [ux, uy] = norm(ARM[0], ARM[1]), [px, py] = [-uy * 1.8, ux * 1.8];
    G.merge(lv, G.transform(G.extrude(G.piece(), [[px, py], [ARM[0] + px, ARM[1] + py], [ARM[0] - px, ARM[1] - py], [-px, -py]], {depth: 2}), {origin: [0, 0, PIVOT_Z]}));
  }
  G.lathe(lv, [[0, 0], [0, 0.8], [PIVOT_Z - ROCK_Z + 1, 0.8], [PIVOT_Z - ROCK_Z + 1, 0]], {axis: 'z', at: [ARM[0], ARM[1], ROCK_Z - 1], segments: 32});
  G.merge(lever, G.transform(lv, turnZ(phi, XR, 0)));

  // the rocker: a plate with a slot for the pin, on its post
  const rocker = G.part('rocker', 'Roller lever');
  const rk = G.piece();
  const S0 = 5.6, S1 = 9.6, SW = 1.1;            // the slot, from the post outwards
  G.extrude(rk, [[-L1 - 2, -2.2], [S1 + 2, -2.2], [S1 + 2, 2.2], [-L1 - 2, 2.2]], {depth: 1.5, holes: [[[S0, -SW], [S1, -SW], [S1, SW], [S0, SW]]]});
  G.lathe(rk, [[0, 0], [0, 2.4], [1.5, 2.4], [1.5, 0]], {axis: 'z', at: [0, 0, 0], segments: 48});
  G.merge(rocker, G.transform(rk, {...turnZ(roll.psi, Q[0], Q[1]), origin: [Q[0], Q[1], ROCK_Z]}));
  G.lathe(rocker, [[0, 0], [0, 1.6], [ROCK_Z - 38, 1.6], [ROCK_Z - 38, 0]], {axis: 'z', at: [Q[0], Q[1], 38], segments: 32});   // the post
  // the roller's bracket, down from the rocker's end
  G.box(rocker, [roll.x - 3.2, roll.y - 1, ROLL_Z], [roll.x - 2.4, roll.y + 1, ROCK_Z]);
  G.box(rocker, [roll.x + 2.4, roll.y - 1, ROLL_Z], [roll.x + 3.2, roll.y + 1, ROCK_Z]);

  const roller = G.part('roller', 'Roller');
  G.lathe(roller, [[0, 0], [0, ROLL_R], [4.4, ROLL_R], [4.4, 0]], {axis: 'x', at: [roll.x - 2.2, roll.y, ROLL_Z], segments: 48});

  // The lens: a fixed bayonet and barrel; the focus ring, whose scale turns past the index; and
  // the optics, which move out as the ring is turned, carrying the cam at their back
  const lens = G.part('lens', 'Lens');
  G.lathe(lens, [[0, 20], [0, 25], [2.5, 25], [2.5, 22.5], [4.5, 22.5], [4.5, 20]], {axis: 'y', at: [XL, FRONT, ZL], segments: 120});
  G.line(lens, [XL, FRONT + 2.7, ZL + 22.55], [XL, FRONT + 4.4, ZL + 22.55], 'detail');                // the index
  const yo = FRONT + EXT;                          // the optics, moved out
  G.lathe(lens, [[camFace + 3 - yo, 0], [camFace + 3 - yo, 11.5], [12, 11.5], [12, 21], [21, 21], [21, 22.6], [27, 22.6], [27, 21], [33, 21], [33, 20], [34, 20], [34, 0]], {axis: 'y', at: [XL, yo, ZL], segments: 120});
  G.circle(lens, [XL, yo + 34.05, ZL], 15, [0, 1, 0], {role: 'detail', segments: 96});              // the front glass
  for (let i = 0; i < 24; i++) {                    // the aperture ring's grip
    const a = i / 24 * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    G.line(lens, [XL + 22.65 * s, yo + 22.5, ZL + 22.65 * c], [XL + 22.65 * s, yo + 25.5, ZL + 22.65 * c], 'texture');
  }

  const ring = G.part('focus-ring', 'Focus ring');
  G.lathe(ring, [[4.6, 20.5], [4.6, 23], [7, 23], [7, 24], [13, 24], [13, 20.5]], {axis: 'y', at: [XL, FRONT, ZL], segments: 120});
  const SPAN = 70 * Math.PI / 180;                 // the ring turns 100° from infinity to 0.7 m
  const at = (a, r, y) => [XL + r * Math.sin(a), y, ZL + r * Math.cos(a)];
  for (const d of [0, 1 / 3, 1 / 2, 1 / 1.5, 1 / 1.2, 1, 1 / 0.85, 1 / 0.7]) {    // its distance scale
    const a = (v - d) * SPAN;
    G.line(ring, at(a, 23.05, FRONT + 4.7), at(a, 23.05, FRONT + (d === 0 ? 6.9 : 6.1)), 'detail');
  }
  for (let i = 0; i < 30; i++) {                    // the grip, turning with the ring
    const a = v * SPAN + i / 30 * Math.PI * 2;
    G.line(ring, at(a, 24.05, FRONT + 8), at(a, 24.05, FRONT + 12), 'texture');
  }

  const cam = G.part('cam', 'Focusing cam');
  G.lathe(cam, [[0, 12], [0, 19.5], [3, 19.5], [3, 12]], {axis: 'y', at: [XL, camFace, ZL], segments: 120});

  // The light, from the subject through the viewfinder window straight to the eye, and through
  // the rangefinder window to the mirror
  const light = G.part('light', 'Light from the subject');
  const S = [XF, Yt, Z], M = [XR, 0, Z], P = [XF, 0, Z], E = [XF, BACK - 16, Z];
  G.line(light, S, P, 'detail');
  G.line(light, P, E, 'detail');
  G.line(light, S, M, 'detail');

  // The rangefinder's line of sight: where the mirror is turned to look, across to the
  // half-silvered mirror and into the middle of the finder. It crosses the viewfinder's line where
  // the lens is focused; on the subject when the lens is focused on it.
  const sight = G.part('sight', 'Rangefinder line of sight');
  const F = Ys <= far ? [XF, Ys, Z] : null;
  G.line(sight, F ?? [XR - din[0] * ((far) / -din[1]), far, Z], M, 'axis');
  G.line(sight, M, P, 'axis');
  if (F) {                                         // where the lens is focused
    G.circle(sight, F, 3.2, [0, 0, 1], {role: 'detail', segments: 36});
    G.line(sight, [F[0] - 5, F[1], F[2]], [F[0] + 5, F[1], F[2]], 'detail');
  }

  // The subject, a post 1 m away
  const subject = G.part('subject', 'Subject, 1 m away');
  G.lathe(subject, [[0, 0], [0, 6], [1.6, 6], [1.6, 1.6], [Z + 9 - (Z - 24), 1.6], [Z + 9 - (Z - 24), 0]], {axis: 'z', at: [XF, Yt, Z - 24], segments: 72});
  G.lathe(subject, [[-3.6, 0], [-3.3, 1.5], [-2.2, 2.8], [0, 3.6], [2.2, 2.8], [3.3, 1.5], [3.6, 0]], {axis: 'z', at: [XF, Yt, Z + 12.6], segments: 72});

  // Every setting fits the page the same way: a fixed frame of hidden trails round all of them
  const frame = [[-W / 2, BACK - 16, 0], [W / 2, far + 4, Z + 17]];
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [frame[i & 1][0], frame[(i >> 1) & 1][1], frame[(i >> 2) & 1][2]]);
  const trails = corners.map(c => ({a: c, b: [c[0] + 0.01, c[1], c[2]], role: 'texture'}));

  const parts = [body, vfWin, rfWin, splitter, eye, mirror, lever, rocker, roller, lens, ring, cam, light, sight, subject];
  const camera = options.camera ?? {azimuth: -64, elevation: 42, roll: 0};
  const result = TechnicalProjection.render(parts, {...options, camera, trails});
  // where each part's label points, moving with it (the build lays the labels out once, for
  // every setting, so they hold still while the leaders follow the parts)
  const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const [ax, ay] = rot(ARM[0] * 0.55, ARM[1] * 0.55, phi), [kx, ky] = rot(-L1 * 0.45, 0, roll.psi);
  const anchors = {
    body: [W / 2 - 4, BACK, 22], 'vf-window': [XF - 12, FRONT, Z + 7.5], 'rf-window': [XR + 6.5, FRONT, Z + 5],
    splitter: [XF, 0, Z + 6.5], eyepiece: [XF - 8.5, BACK - 4, Z], mirror: [XR, 0, Z + 6],
    lever: [XR + ax, ay, PIVOT_Z + 2], rocker: [Q[0] + kx, Q[1] + ky, ROCK_Z + 1.5], roller: [roll.x, roll.y, ROLL_Z + ROLL_R],
    cam: [XL - 19.5, camFace + 1.5, ZL], lens: [XL + 21, yo + 30, ZL], 'focus-ring': [XL - 24, FRONT + 10, ZL],
    light: lerp(S, P, 0.45), sight: lerp(M, F ?? [XR - din[0] * (far / -din[1]), far, Z], 0.42), subject: [XF, Yt, Z + 16.2]
  };
  return {...result, camera, meta: {Ys, Yt, phi, ext: EXT, anchors, pin, contact: Math.hypot(roll.x - XL, ROLL_Z - ZL), slot: Math.hypot(pin[0] - Q[0], pin[1] - Q[1])}};
};
