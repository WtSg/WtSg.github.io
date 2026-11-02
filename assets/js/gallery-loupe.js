/*
 * Shared by the gallery versions (instant prints, slide night, contact sheet):
 * the photo list from the page, the close-up viewer, and light friction against
 * casual saving. Each version styles the viewer in its own world (.gl tokens).
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function still() { return reduceMq.matches; }
  function strip(v) { return v == null ? "" : String(v).trim(); }
  function esc(s) {
    return strip(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- The photos ---------- */
  var dataEl = document.getElementById("gallery-data");
  var base = dataEl ? dataEl.getAttribute("data-base") || "" : "";
  var raw = [];
  try { raw = JSON.parse(dataEl ? dataEl.textContent : "[]") || []; } catch (e) { raw = []; }
  var photos = raw.map(function (p, i) {
    var w = +p.w || 3, h = +p.h || 2;
    return {
      i: i,
      src: base + p.src,
      thumb: base + (p.thumb || p.src),
      w: w,
      h: h,
      ar: w / h,
      title: strip(p.title),
      place: strip(p.place),
      year: strip(p.year),
      exif: p.exif || null
    };
  });

  function metaLine(p) {
    return [p.place, p.year].filter(Boolean).join(" · ");
  }
  function specLine(p) {
    var e = p.exif;
    if (!e) return "";
    return ["camera", "focal", "aperture", "shutter", "iso"].map(function (k) { return strip(e[k]); }).filter(Boolean).join(" · ");
  }
  function specRows(p) {
    var e = p.exif;
    if (!e) return [];
    return [
      ["Camera", e.camera], ["Lens", e.lens], ["Focal length", e.focal],
      ["Aperture", e.aperture], ["Shutter", e.shutter], ["ISO", strip(e.iso).replace(/^ISO\s*/i, "")]
    ].filter(function (r) { return strip(r[1]); });
  }
  function label(p) {
    return "No. " + (p.i + 1) + (p.title ? " · " + p.title : "");
  }
  function altText(p) {
    return (p.title || "Photograph No. " + (p.i + 1)) + (p.place ? ", " + p.place : "");
  }

  /* ---------- Owner shortcut and friction ---------- */
  try {
    if (localStorage.getItem("gallery-studio-owner") === "1") {
      Array.prototype.forEach.call(document.querySelectorAll("[data-owner-only]"), function (el) { el.hidden = false; });
    }
  } catch (e) {}
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest("[data-photo], .gl__img")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  /* ---------- The close-up viewer ---------- */
  var dialog = document.querySelector("dialog.gl");
  var api = {
    photos: photos,
    still: still,
    esc: esc,
    label: label,
    metaLine: metaLine,
    specLine: specLine,
    altText: altText,
    open: function () {},
    onClose: null,
    onStep: null
  };
  window.Gallery = api;
  if (!dialog || typeof dialog.showModal !== "function" || !photos.length) return;

  var stage = dialog.querySelector(".gl__stage");
  var img = dialog.querySelector(".gl__img");
  var cap = dialog.querySelector(".gl__cap");
  var spec = dialog.querySelector(".gl__spec");
  var count = dialog.querySelector(".gl__count");
  var index = 0, openedAt = 0, opener = null, closing = false;

  function fill(i, fromSrc) {
    var p = photos[i];
    img.style.setProperty("--ar", p.ar);
    img.alt = altText(p);
    img.src = fromSrc || p.src;
    if (fromSrc && fromSrc !== p.src) {
      var pre = new Image();
      pre.onload = function () { if (index === i && dialog.open) img.src = p.src; };
      pre.src = p.src;
    }
    var meta = metaLine(p);
    cap.innerHTML = '<p class="gl__title">' + esc(label(p)) + "</p>" + (meta ? '<p class="gl__meta">' + esc(meta) + "</p>" : "");
    var rows = specRows(p);
    spec.innerHTML = rows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("");
    spec.hidden = !rows.length;
    count.textContent = (i + 1) + " / " + photos.length;
    [i + 1, i - 1].forEach(function (k) {
      var n = new Image();
      n.src = photos[(k + photos.length) % photos.length].src;
    });
  }

  api.open = function (i, from, focusBack, fromSrc) {
    index = openedAt = i;
    opener = focusBack || (from && from.focus ? from : null);
    closing = false;
    fill(i, fromSrc);
    dialog.showModal();
    root.classList.add("gl-open");
    if (still() || !img.animate) return;
    var r0 = null;
    if (from && from.getBoundingClientRect) r0 = from.getBoundingClientRect();
    else if (from && from.width) r0 = from;
    img.style.opacity = "0";
    requestAnimationFrame(function () {
      img.style.opacity = "";
      var r1 = img.getBoundingClientRect();
      if (!r0 || !r0.width || !r1.width) return;
      var dx = (r0.left + r0.width / 2) - (r1.left + r1.width / 2);
      var dy = (r0.top + r0.height / 2) - (r1.top + r1.height / 2);
      var s = r0.width / r1.width;
      img.animate([
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")" },
        { transform: "translateY(-1rem) scale(1.03) rotateX(5deg)", offset: 0.62 },
        { transform: "none" }
      ], { duration: 760, easing: "cubic-bezier(.2,.75,.25,1)" });
    });
  };

  function close() {
    if (!dialog.open || closing) return;
    if (still() || !dialog.animate) { dialog.close(); return; }
    closing = true;
    var a = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" });
    a.onfinish = function () { dialog.close(); };
  }
  function step(d) {
    var n = (index + d + photos.length) % photos.length;
    if (api.onStep) api.onStep(n);
    if (still() || !img.animate) { index = n; fill(n); return; }
    var out = img.animate([
      { transform: "none", opacity: 1 },
      { transform: "translateX(" + (-d * 4) + "%)", opacity: 0 }
    ], { duration: 160, easing: "ease-in", fill: "forwards" });
    out.onfinish = function () {
      index = n;
      fill(n);
      out.cancel();
      img.animate([
        { transform: "translateX(" + (d * 4) + "%)", opacity: 0 },
        { transform: "none", opacity: 1 }
      ], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
    };
  }

  dialog.addEventListener("click", function (e) {
    var act = e.target.closest("[data-gl]");
    if (act) {
      var a = act.getAttribute("data-gl");
      if (a === "prev") step(-1);
      else if (a === "next") step(1);
      else close();
      return;
    }
    if (e.target === dialog || e.target === stage) close();
  });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  });
  dialog.addEventListener("cancel", function (e) {
    if (!still()) { e.preventDefault(); close(); }
  });
  var sx = null;
  stage.addEventListener("pointerdown", function (e) { sx = e.clientX; });
  stage.addEventListener("pointerup", function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });
  dialog.addEventListener("close", function () {
    closing = false;
    root.classList.remove("gl-open");
    if (api.onClose) api.onClose(index, index !== openedAt);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });
})();
