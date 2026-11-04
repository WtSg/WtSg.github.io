// The lens's glass: a classic double-Gauss design (six elements in four groups, the layout of
// many 50 mm lenses), the textbook form scaled to a 50 mm focal length. An illustration, not any
// one lens's prescription. Shared by the camera taken apart (exploded.js) and the section through
// the lens with its light (lens-section.cjs), so both draw the same glass.
//
// Millimetres along the axis from the front vertex (z), heights from the axis (h). Each surface:
// its vertex z, radius of curvature R (centre at z + R; Infinity for flat), the refractive index
// after it, and its clear semi-diameter (beyond it the surface turns flat, a land, out to the
// element's rim). Indices are typical of crown and flint glasses.
(function (root) {
  const SCALE = 0.5;
  const RAW = [  // radius, thickness to the next surface, index after (the 100 mm textbook form)
    [54.153, 8.747, 1.6074], [152.522, 0.5, 1], [35.951, 14.0, 1.6204], [Infinity, 3.777, 1.6034], [22.270, 14.253, 1],
    ['stop', 12.428, 1],
    [-25.685, 3.777, 1.6034], [Infinity, 10.834, 1.6204], [-36.980, 0.5, 1], [196.417, 6.858, 1.6204], [-67.148, 57.315, 1]
  ];
  const CLEAR = [14.5, 14.5, 13, 13, 9.6, null, 8.6, 11.5, 11.5, 11.5, 11.5];
  let z = 0;
  const surfaces = RAW.map(([r, t, n], i) => {
    const s = {z, R: r === 'stop' ? null : r * SCALE, n, clear: CLEAR[i], stop: r === 'stop'};
    z += t * SCALE;
    return s;
  });
  const sag = (R, h) => (R === null || !isFinite(R)) ? 0 : R - Math.sign(R) * Math.sqrt(R * R - h * h);
  // where a surface stands at height h: on its curve inside the clear aperture, on its land outside
  const surfaceZ = (s, h) => s.z + sag(s.R, Math.min(Math.abs(h), s.clear));

  // paraxial focal length and back focal distance (last vertex to the focus at infinity)
  let y = 1, u = 0, n = 1;
  surfaces.forEach((s, i) => {
    if (!s.stop) u = (n * u - y * (isFinite(s.R) ? 1 / s.R : 0) * (s.n - n)) / s.n;
    n = s.n;
    if (i < surfaces.length - 1) y += u * (surfaces[i + 1].z - s.z);
  });
  const efl = -1 / u, last = surfaces[surfaces.length - 1].z, bfd = -y / u;
  const film = last + bfd;                // the film, with the lens at infinity
  const stopIndex = surfaces.findIndex(s => s.stop);

  // the elements: the surfaces bounding each, its rim, and its group (cemented pairs share one)
  const elements = [
    {id: 'l1', name: 'Front element', group: 1, front: 0, back: 1, rim: 14.5},
    {id: 'l2', name: 'Front pair, outer', group: 2, front: 2, back: 3, rim: 13},
    {id: 'l3', name: 'Front pair, inner', group: 2, front: 3, back: 4, rim: 13},
    {id: 'l4', name: 'Rear pair, inner', group: 3, front: 6, back: 7, rim: 11.5},
    {id: 'l5', name: 'Rear pair, outer', group: 3, front: 7, back: 8, rim: 11.5},
    {id: 'l6', name: 'Rear element', group: 4, front: 9, back: 10, rim: 11.5}
  ];
  // an element's half-section, from the axis at its front vertex, up its front surface to the rim,
  // and back down its rear surface: [z, h] points (a closed [x, r] profile for a lathe)
  function profile(el, steps = 24) {
    const f = surfaces[el.front], b = surfaces[el.back], pts = [];
    for (let i = 0; i <= steps; i++) { const h = el.rim * i / steps; pts.push([surfaceZ(f, h), h]); }
    for (let i = steps; i >= 0; i--) { const h = el.rim * i / steps; pts.push([surfaceZ(b, h), h]); }
    return pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
  }

  const api = {surfaces, elements, profile, sag, surfaceZ, efl, bfd, film, stopIndex, length: last};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LensOptics = api;
})(typeof self !== 'undefined' ? self : globalThis);
