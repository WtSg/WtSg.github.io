// Taking the picture, seen from where the lens is: the focal-plane shutter caught mid-travel and
// the film behind it. Two curtains run across just in front of the film, the first opening the
// frame, the second following to close it; the light gets through the slit between them. The film
// runs from its cassette across the gate, one frame at a time, onto the take-up spool. An
// illustrative concept of the classic layout (a horizontal two-curtain shutter, a 35 mm film
// cassette), not any one camera's construction. Millimetres: x across the camera, y towards the
// lens, z up; the frame is 36 × 24, the film 35 wide.
self.DrawingModels ??= {};
self.DrawingModels['shutter-film'] = (parameters, options) => {
  const G = TechnicalGeometry;
  const FW = 36, FH = 24, FILM = 35;                   // the frame, the film's width
  const E1 = 8, E2 = -2;                                // the curtains' edges: the slit between them
  const DRUM = 25, DY = 3.2, DR = 3.2;                  // the drums, either side of the gate

  // the film gate: a plate with the frame's opening
  const gate = G.part('gate', 'Film gate', [0, 6, 0]);
  {
    const piece = G.extrude(G.piece(), [[-27, -19], [27, -19], [27, 19], [-27, 19]], {depth: 1.2, holes: [[[-FW / 2, -FH / 2], [FW / 2, -FH / 2], [FW / 2, FH / 2], [-FW / 2, FH / 2]]]});
    G.merge(gate, G.transform(piece, {origin: [0, 1.6, 0], ...G.plane('xz')}));
  }

  // the film: a strip across the gate, its frames and sprocket holes; wound into the cassette at
  // one end (the photographer's left) and onto the spool at the other
  const film = G.part('film', 'Film');
  G.box(film, [-38, -0.1, -FILM / 2], [40, 0.1, FILM / 2]);
  const frameAt = x0 => G.polyline(film, [[x0, 0.12, -FH / 2], [x0 + FW, 0.12, -FH / 2], [x0 + FW, 0.12, FH / 2], [x0, 0.12, FH / 2]], {closed: true, role: 'detail'});
  frameAt(-FW / 2);
  frameAt(-FW / 2 + 38);
  for (let x = -37; x < 39; x += 4.75) {
    for (const zc of [-15.3, 15.3]) G.polyline(film, [[x, 0.12, zc - 0.9], [x + 2, 0.12, zc - 0.9], [x + 2, 0.12, zc + 0.9], [x, 0.12, zc + 0.9]], {closed: true, role: 'texture'});
  }
  const cassette = G.part('cassette', 'Film cassette', [-14, 0, 0]);
  G.lathe(cassette, [[0, 0], [0, 3.5], [1.6, 3.5], [1.6, 12.4], [40.6, 12.4], [40.6, 3.5], [42.2, 3.5], [42.2, 0]], {axis: 'z', at: [-50, -6, -21.1], segments: 72});
  G.box(cassette, [-43, -6, -20.3], [-37.5, 0.4, 20.3]);
  const spool = G.part('spool', 'Take-up spool', [14, 0, 0]);
  G.lathe(spool, [[0, 0], [0, 9.6], [1.6, 9.6], [1.6, 8.2], [36.6, 8.2], [36.6, 9.6], [38.2, 9.6], [38.2, 0]], {axis: 'z', at: [47, -7, -19.1], segments: 72});
  G.circle(spool, [47, -7, -17.4], 6.4, [0, 0, 1], {role: 'detail', segments: 72});

  // the light that gets through the slit, falling on the film
  const exposure = G.part('exposure', 'Light through the slit');
  G.box(exposure, [E2, 0.15, -FH / 2], [E1, 0.35, FH / 2]);
  const light = G.part('light', 'Light from the lens');
  for (const [x, z] of [[-1, 9], [7, 9], [3, 0], [-1, -9], [7, -9]]) G.line(light, [x * 0.4, 60, z * 0.5], [x, 0.4, z], 'detail');

  // the shutter: the curtain drums, the first curtain (its edge at E1, the rest wound towards the
  // right drum), the second (from the left drum to its edge at E2)
  const drums = G.part('drums', 'Curtain drums', [0, 22, 0]);
  for (const x of [-DRUM, DRUM]) {
    G.lathe(drums, [[0, 0], [0, DR], [34, DR], [34, 0]], {axis: 'z', at: [x, DY + 4, -17], segments: 48});
  }
  const first = G.part('first', 'First curtain', [0, 12, 0]);
  G.box(first, [E1, DY + 1, -15], [DRUM, DY + 1.4, 15]);
  G.box(first, [E1 - 0.6, DY + 0.8, -15.5], [E1 + 1.2, DY + 1.6, 15.5]);     // its edge bar
  const second = G.part('second', 'Second curtain', [0, 16, 0]);
  G.box(second, [-DRUM, DY + 2.4, -15], [E2, DY + 2.8, 15]);
  G.box(second, [E2 - 1.2, DY + 2.2, -15.5], [E2 + 0.6, DY + 3.0, 15.5]);

  const parts = [film, exposure, cassette, spool, gate, first, second, drums, light];
  const camera = options.camera ?? {azimuth: 62, elevation: 24, roll: 0};
  return TechnicalProjection.render(parts, {...options, camera});
};
