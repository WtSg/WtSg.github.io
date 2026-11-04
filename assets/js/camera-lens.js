/*
 * The light through the lens (photography/camera): the section through the lens and the mount to
 * the film (assets/img/teardown/lens.json, made by _teardown/rangefinder/lens-section.cjs from the
 * lens's prescription), and the light from one point of a subject 1 m away traced through it, surface
 * by surface (Snell's law, in the plane of the section). The aperture's blades stop the outer rays;
 * focusing slides the optical unit forward. Where the rays meet the film, a small magnified view
 * shows the spot they make: a point when the lens is focused on the subject, a disc when not.
 * Exposes window.CameraLens.figure(element, data, options).
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var STOPS = [2, 2.8, 4, 5.6, 8, 11, 16];

  function refract(N, d, n1, n2) {
    var ci = -(N[0] * d[0] + N[1] * d[1]);
    if (ci < 0) { N = [-N[0], -N[1]]; ci = -ci; }
    var e = n1 / n2, k = 1 - e * e * (1 - ci * ci);
    if (k < 0) return null;
    var a = e * ci - Math.sqrt(k);
    return [e * d[0] + a * N[0], e * d[1] + a * N[1]];
  }
  // one ray, from a point in a direction, through the lens moved forward by shift; it stops where
  // glass or the blades stop it, or at the film
  function trace(L, from, dir, shift, rStop) {
    var p = from.slice(), d = dir.slice(), n = 1, pts = [p.slice()], S = L.surfaces;
    for (var i = 0; i < S.length; i++) {
      var s = S[i], zv = s.z - shift, t;
      if (s.stop || s.R === null) {
        t = (zv - p[0]) / d[0];
        p = [p[0] + d[0] * t, p[1] + d[1] * t];
        pts.push(p.slice());
        if (s.stop) { if (Math.abs(p[1]) > rStop) return { pts: pts, blocked: true }; continue; }
        if (Math.abs(p[1]) > s.clear) return { pts: pts, blocked: true };
        d = refract([-1, 0], d, n, s.n);
      } else {
        var c = zv + s.R, ox = p[0] - c, oy = p[1], b = ox * d[0] + oy * d[1], cc = ox * ox + oy * oy - s.R * s.R, D = b * b - cc;
        if (D < 0) return { pts: pts, blocked: true };
        t = s.R > 0 ? -b - Math.sqrt(D) : -b + Math.sqrt(D);
        p = [p[0] + d[0] * t, p[1] + d[1] * t];
        pts.push(p.slice());
        if (Math.abs(p[1]) > s.clear) return { pts: pts, blocked: true };
        d = refract([-(p[0] - c) / s.R, -p[1] / s.R], d, n, s.n);
      }
      if (!d) return { pts: pts, blocked: true };
      n = s.n;
    }
    t = (L.film - p[0]) / d[0];
    p = [p[0] + d[0] * t, p[1] + d[1] * t];
    pts.push(p);
    return { pts: pts, blocked: false, hit: p[1] };
  }
  // a ray from the subject's point toward a height on the front of the lens
  function fromSubject(L, dist, shift, h, rStop) {
    var o = [L.film - dist, 0], aim = [-shift, h], dx = aim[0] - o[0], dy = aim[1] - o[1], m = Math.hypot(dx, dy);
    return trace(L, o, [dx / m, dy / m], shift, rStop);
  }
  // the stop's radius at f/2, from the marginal ray of a beam from infinity
  function stopAtF2(L) {
    var S = L.surfaces, r = trace(L, [L.start, L.efl / 4], [1, 0], 0, 1e9), i = 0;
    for (; i < S.length; i++) if (S[i].stop) break;
    return Math.abs(r.pts[i + 1][1]);
  }
  // how far the optical unit moves out to focus at a distance from the film (mm), by bisection on
  // a ray close to the axis
  function extension(L, dist) {
    if (!isFinite(dist)) return 0;
    var lo = 0, hi = 12;
    for (var k = 0; k < 40; k++) {
      var mid = (lo + hi) / 2, r = fromSubject(L, dist, mid, 0.5, 1e9);
      var a = r.pts[r.pts.length - 2], b = r.pts[r.pts.length - 1];
      var zc = a[0] - a[1] * (b[0] - a[0]) / (b[1] - a[1]);   // where the ray crosses the axis
      if (zc > L.film) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var f2 = function (n) { return Number(n.toFixed(2)); };

  /*
   * figure(holder, data, {subject: mm, focus: mm (Infinity for ∞), stop: f-number, rays: count})
   * returns {set({focus, stop}), state()}
   */
  function figure(holder, L, o) {
    o = o || {};
    var subject = o.subject || 1000, rStop2 = stopAtF2(L), still = !!o.still;
    var svg = el("svg", { viewBox: L.viewBox, class: "ls", role: "img", "aria-label": o.label || "The light from one point of the subject through the lens to the film" });
    var fixed = el("g", { class: "ls-fixedgroup" }, svg);
    fixed.innerHTML = L.fixed;
    var light = el("g", { class: "ls-light" }, svg);
    var optics = el("g", { class: "ls-optics" }, svg);
    optics.innerHTML = L.optics;
    var blades = el("g", { class: "ls-blades" }, optics);
    var bladeUp = el("path", { class: "ls-blade" }, blades), bladeDown = el("path", { class: "ls-blade" }, blades);
    var spot = el("path", { class: "ls-spot" }, svg);
    var labels = el("g", { class: "ls-labels" }, svg);
    labels.innerHTML = L.labels;
    holder.appendChild(svg);

    // the magnified spot on the film, in a holder of its own beside the drawing
    var eyeSpot = null, eyeCap = null;
    if (o.inset) {
      var eye = document.createElement("figure");
      eye.className = "ls-eye";
      eye.innerHTML = '<svg viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true" focusable="false"><defs><radialGradient id="' + o.inset + '-g"><stop offset="0" stop-color="#fff3e0"/><stop offset=".45" stop-color="#ffb35a"/><stop offset="1" stop-color="#ff4a2e" stop-opacity="0"/></radialGradient></defs>' +
        '<rect x="-1.25" y="-1.25" width="2.5" height="2.5" fill="#15130f"/><circle class="ls-eye__spot" r=".05" fill="url(#' + o.inset + '-g)"/></svg>' +
        '<figcaption><b>On the film</b>, magnified<span></span></figcaption>';
      (o.insetHolder || holder).appendChild(eye);
      eyeSpot = eye.querySelector(".ls-eye__spot");
      eyeCap = eye.querySelector("figcaption span");
    }

    var cur = { shift: extension(L, o.focus == null ? subject : o.focus), r: rStop2 * 2 / (o.stop || 2), stop: o.stop || 2, focus: o.focus == null ? subject : o.focus };
    var target = { shift: cur.shift, r: cur.r }, anim = 0, out = { blur: 0 };
    function draw() {
      var shift = cur.shift, rStop = cur.r;
      optics.setAttribute("transform", "translate(" + f2(-shift) + " 0)");
      // the blades, from the barrel wall in to the opening
      var z = L.stop.z, w = L.stop.wall;
      bladeUp.setAttribute("d", "M" + f2(z - 0.35) + " " + f2(-w) + "H" + f2(z + 0.35) + "V" + f2(-rStop) + "H" + f2(z - 0.35) + "Z");
      bladeDown.setAttribute("d", "M" + f2(z - 0.35) + " " + f2(w) + "H" + f2(z + 0.35) + "V" + f2(rStop) + "H" + f2(z - 0.35) + "Z");
      // the light: a fan across the front glass, and a fine sweep for the spot it makes
      var n = o.rays || 11, html = "", lo = Infinity, hi = -Infinity, k, r, h;
      for (k = 0; k < n; k++) {
        h = -12.3 + 24.6 * k / (n - 1);
        r = fromSubject(L, subject, shift, h, rStop);
        // start the ray at the drawing's left edge
        var a = r.pts[0], b = r.pts[1], t = (L.start - a[0]) / (b[0] - a[0]), first = [L.start, a[1] + (b[1] - a[1]) * t];
        var d = "M" + f2(first[0]) + " " + f2(-first[1]);
        for (var j = 1; j < r.pts.length; j++) d += "L" + f2(r.pts[j][0]) + " " + f2(-r.pts[j][1]);
        html += '<path class="ls-ray' + (r.blocked ? " is-blocked" : "") + '" d="' + d + '"/>';
      }
      // where the light would meet, if the film were not there: a faint continuation behind it
      var mid = fromSubject(L, subject, shift, 3, 1e9), m1 = mid.pts[mid.pts.length - 2], m2 = mid.pts[mid.pts.length - 1];
      var meet = m1[0] - m1[1] * (m2[0] - m1[0]) / (m2[1] - m1[1]);
      if (meet > L.film + 0.05 && meet < L.film + 9) {
        for (k = 0; k < n; k++) {
          h = -12.3 + 24.6 * k / (n - 1);
          r = fromSubject(L, subject, shift, h, rStop);
          if (r.blocked) continue;
          var q1 = r.pts[r.pts.length - 2], q2 = r.pts[r.pts.length - 1], s2 = (meet - q1[0]) / (q2[0] - q1[0]);
          html += '<path class="ls-ray is-beyond" d="M' + f2(q2[0]) + " " + f2(-q2[1]) + "L" + f2(meet) + " " + f2(-(q1[1] + (q2[1] - q1[1]) * s2)) + '"/>';
        }
      }
      for (k = 0; k <= 60; k++) {
        r = fromSubject(L, subject, shift, -12.6 + 25.2 * k / 60, rStop);
        if (!r.blocked) { lo = Math.min(lo, r.hit); hi = Math.max(hi, r.hit); }
      }
      light.innerHTML = html;
      var blur = isFinite(lo) ? hi - lo : 0;
      out.blur = blur;
      spot.setAttribute("d", isFinite(lo) ? "M" + f2(L.film) + " " + f2(-hi - 0.15) + "L" + f2(L.film) + " " + f2(-lo + 0.15) : "");
      if (eyeSpot) {
        // the light that gets through falls with the opening's area; spread over the spot, it dims
        var rad = Math.max(blur / 2, 0.11), amount = Math.pow(rStop / rStop2, 2), level = amount * Math.pow(0.11 / rad, 2);
        eyeSpot.setAttribute("r", rad.toFixed(3));
        eyeSpot.setAttribute("opacity", Math.min(1, 0.22 + 0.78 * Math.sqrt(level)).toFixed(3));
        eyeCap.textContent = blur < 0.15 ? ": a sharp point" : ": a blurred disc, " + blur.toFixed(1) + " mm across";
      }
    }
    function step() {
      var k = still ? 1 : 0.25;
      cur.shift += (target.shift - cur.shift) * k;
      cur.r += (target.r - cur.r) * k;
      if (Math.abs(target.shift - cur.shift) < 0.002 && Math.abs(target.r - cur.r) < 0.002) { cur.shift = target.shift; cur.r = target.r; anim = 0; draw(); return; }
      draw();
      anim = requestAnimationFrame(step);
    }
    draw();
    return {
      set: function (s) {
        if (s.focus !== undefined) { cur.focus = s.focus; target.shift = extension(L, s.focus); }
        if (s.stop !== undefined) { cur.stop = s.stop; target.r = rStop2 * 2 / s.stop; }
        if (!anim) anim = requestAnimationFrame(step);
      },
      state: function () { return { shift: cur.shift, r: cur.r, blur: out.blur, focus: cur.focus, stop: cur.stop, target: target.shift, sharp: out.blur < 0.15 }; }
    };
  }
  window.CameraLens = { figure: figure, STOPS: STOPS, extension: extension };
})();
