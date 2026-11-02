/*
 * Contact sheet.
 * - A loupe follows the pointer over the sheet and magnifies whatever is under
 *   it: frames, edge numbers, grease pencil (a live copy of the sheet, scaled).
 * - Choosing a frame rings it in red grease pencil, then shows the enlargement.
 * - Touch screens skip the loupe; reduced motion draws the rings at once.
 */
(function () {
  "use strict";
  var G = window.Gallery;
  var sheet = document.querySelector(".cs-sheet");
  if (!G || !sheet) return;
  var frames = Array.prototype.slice.call(sheet.querySelectorAll(".cs-frame"));
  if (!frames.length) return;
  var marks = sheet.querySelector(".cs-marks");
  var SVGNS = "http://www.w3.org/2000/svg";

  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* A hand-drawn ring: a little more than one turn, wobbling, not closed. */
  function ringPath(cx, cy, rx, ry, seed) {
    var r = rng(seed), pts = [], n = 46, a0 = -2.2 + r() * 0.6, turn = Math.PI * 2 * (1.1 + r() * 0.08);
    var wob = 0;
    for (var k = 0; k <= n; k++) {
      var t = k / n, a = a0 + turn * t;
      wob += (r() - 0.5) * 0.035;
      var grow = 1 + wob + t * 0.05;
      pts.push([cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow]);
    }
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var j = 1; j < pts.length - 1; j++) {
      var mx = (pts[j][0] + pts[j + 1][0]) / 2, my = (pts[j][1] + pts[j + 1][1]) / 2;
      d += " Q" + pts[j][0].toFixed(1) + " " + pts[j][1].toFixed(1) + " " + mx.toFixed(1) + " " + my.toFixed(1);
    }
    return d;
  }

  var marked = [];
  function drawMark(i, animate) {
    var sr = sheet.getBoundingClientRect(), fr = frames[i].getBoundingClientRect();
    var cx = fr.left - sr.left + fr.width / 2, cy = fr.top - sr.top + fr.height / 2;
    var path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", ringPath(cx, cy, fr.width / 2 + 16, fr.height / 2 + 14, 17 + i * 31));
    marks.appendChild(path);
    if (!animate || !path.animate) return Promise.resolve();
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    var a = path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 560, easing: "cubic-bezier(.45,0,.3,1)" });
    return a.finished.catch(function () {}).then(function () { path.style.strokeDasharray = ""; });
  }
  function redrawMarks() {
    marks.innerHTML = "";
    marked.forEach(function (i) { drawMark(i, false); });
    rebuildLens();
  }

  frames.forEach(function (f, i) {
    f.addEventListener("click", function () {
      var first = marked.indexOf(i) === -1;
      var done = Promise.resolve();
      if (first) {
        marked.push(i);
        done = drawMark(i, !G.still());
      }
      done.then(function () {
        rebuildLens();
        var img = f.querySelector("img");
        G.open(i, f.querySelector(".cs-win"), f, img.currentSrc || "");
      });
    });
  });
  var resizeT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(redrawMarks, 120);
  });

  /* ---------- The loupe ---------- */
  var lens = document.querySelector(".cs-lens");
  var view = lens ? lens.querySelector(".cs-lens__view") : null;
  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var M = 2.6, last = null;
  function rebuildLens() {
    if (!view || lens.hidden) return;
    var clone = sheet.cloneNode(true);
    clone.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
    clone.setAttribute("inert", "");
    clone.style.width = sheet.getBoundingClientRect().width + "px";
    view.innerHTML = "";
    view.appendChild(clone);
    if (last) place(last.x, last.y);
  }
  function place(x, y) {
    last = { x: x, y: y };
    var r = sheet.getBoundingClientRect(), R = lens.clientWidth / 2;
    lens.style.setProperty("--x", x + "px");
    lens.style.setProperty("--y", y + "px");
    view.style.transform = "translate(" + (R - (x - r.left) * M).toFixed(1) + "px," + (R - (y - r.top) * M).toFixed(1) + "px) scale(" + M + ")";
  }
  if (fine && lens && view) {
    lens.hidden = false;
    document.body.classList.add("has-lens");
    rebuildLens();
    // Resting on the newest frame until the pointer picks it up.
    function rest() {
      var fr = frames[0].getBoundingClientRect();
      place(fr.left + fr.width * 0.58, fr.top + fr.height * 0.45);
    }
    var img0 = frames[0].querySelector("img");
    if (img0.complete) rest(); else img0.addEventListener("load", rest);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { rebuildLens(); rest(); });
    sheet.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      place(e.clientX, e.clientY);
    });
    window.addEventListener("scroll", function () { if (last) place(last.x, last.y); }, { passive: true });
  }

  G.onClose = function (i, moved) {
    if (moved && marked.indexOf(i) === -1) {
      marked.push(i);
      drawMark(i, false);
      rebuildLens();
    }
  };
})();
