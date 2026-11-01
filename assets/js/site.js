/*
 * Figure 1: x_t = (1 - t) * x0 + t * eps, eps ~ N(0, I).
 * Each noise canvas holds one fixed draw of eps at the panel's pixel grid.
 * Drawing it over the clean panel with opacity t is exactly that interpolant.
 * Loaded synchronously right after the figure, so the first paint is already noise.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Paint i.i.d. standard normal samples (Box-Muller) as gray levels.
  function paintNoise(canvas, seed) {
    var dims = (canvas.getAttribute("data-noise") || "64x64").split("x");
    var w = parseInt(dims[0], 10), h = parseInt(dims[1], 10);
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return false;
    canvas.width = w;
    canvas.height = h;
    var img = ctx.createImageData(w, h), d = img.data, rand = mulberry32(seed), spare = null;
    for (var i = 0; i < w * h; i++) {
      var z;
      if (spare !== null) {
        z = spare;
        spare = null;
      } else {
        var u = 1 - rand(), v = rand(), m = Math.sqrt(-2 * Math.log(u));
        z = m * Math.cos(2 * Math.PI * v);
        spare = m * Math.sin(2 * Math.PI * v);
      }
      var g = Math.round(127.5 + 52 * z);
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      var o = i * 4;
      d[o] = d[o + 1] = d[o + 2] = g;
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return true;
  }

  // ---- Figure 1 sampler ----
  var fig = document.querySelector("[data-sampler]");
  if (fig) {
    var layers = fig.querySelectorAll("canvas[data-noise]");
    var slider = fig.querySelector("input[type=range]");
    var out = fig.querySelector("output");
    var titles = fig.querySelectorAll("[data-t]");
    var painted = layers.length > 0;
    for (var k = 0; k < layers.length; k++) painted = paintNoise(layers[k], 1729 + k) && painted;

    if (painted) {
      var raf = 0, started = false;
      var setT = function (t) {
        for (var j = 0; j < layers.length; j++) layers[j].style.opacity = t;
        if (slider) slider.value = t.toFixed(2);
        if (out) out.innerHTML = "<i>t</i> = " + t.toFixed(2);
        for (var q = 0; q < titles.length; q++) titles[q].textContent = t.toFixed(2);
      };

      var sample = function () {
        if (started) return;
        started = true;
        var t0 = null, hold = 250, dur = 1800;
        var step = function (now) {
          if (t0 === null) t0 = now;
          var p = Math.max(0, Math.min(1, (now - t0 - hold) / dur));
          // cosine-shaped schedule from t = 1 to t = 0: slow start, steady middle, settled finish
          var c = Math.cos((Math.PI / 2) * p);
          setT(c * c);
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      };

      if (reduceMotion) {
        started = true;
        setT(0);
      } else {
        setT(1);
        // Let the name arrive in its own face before it resolves.
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(sample);
        setTimeout(sample, 700);
      }

      if (slider) {
        slider.addEventListener("input", function () {
          started = true;
          cancelAnimationFrame(raf);
          setT(parseFloat(slider.value));
        });
      }
    }
  }

  // ---- Everything below the figure ----
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    // Email: assembled here so the address never appears in the published HTML.
    var mailSrc = document.querySelector("[data-mail-u][data-mail-d]");
    if (mailSrc) {
      var addr = mailSrc.getAttribute("data-mail-u") + "@" + mailSrc.getAttribute("data-mail-d");
      Array.prototype.forEach.call(document.querySelectorAll("[data-mail]"), function (a) {
        a.setAttribute("href", "mailto:" + addr);
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
        b.setAttribute("data-copy", addr);
      });
    }

    // Static noise panels (t = 1).
    var statics = document.querySelectorAll("canvas.noise--static[data-noise]");
    for (var i = 0; i < statics.length; i++) paintNoise(statics[i], 4242 + i);

    // Copy-to-clipboard buttons.
    var buttons = document.querySelectorAll("[data-copy]");
    Array.prototype.forEach.call(buttons, function (btn) {
      var label = btn.querySelector("[data-copy-label]");
      var original = label ? label.textContent : "";
      var timer = 0;
      var show = function (text, ok) {
        if (label) label.textContent = text;
        btn.classList.toggle("is-done", ok);
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (label) label.textContent = original;
          btn.classList.remove("is-done");
        }, 2400);
      };
      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy");
        if (!text) { show("Couldn't copy; use the Email me button", false); return; }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(
            function () { show("Copied", true); },
            function () { show("Couldn't copy; use the Email me button", false); }
          );
        } else {
          show("Couldn't copy; use the Email me button", false);
        }
      });
    });

    // Videos: a drawn play/pause control replaces the browser chrome. They play only
    // while on screen, never on their own under reduced motion, and never after a pause.
    var ICON_PLAY = '<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 3.5v9l7.25-4.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    var ICON_PAUSE = '<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5.5 3.5v9M10.5 3.5v9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    var videos = document.querySelectorAll("video[data-autoplay]");
    var io = (!reduceMotion && "IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting && !v._held) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else if (!entry.isIntersecting) {
          v.pause();
        }
      });
    }, { rootMargin: "120px" }) : null;

    Array.prototype.forEach.call(videos, function (v) {
      v.removeAttribute("controls");
      v._held = !io;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vctl";
      var render = function () {
        var playing = !v.paused && !v.ended;
        btn.innerHTML = (playing ? ICON_PAUSE : ICON_PLAY) + "<span>" + (playing ? "Pause video" : "Play video") + "</span>";
      };
      btn.addEventListener("click", function () {
        if (v.paused) {
          v._held = false;
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v._held = true;
          v.pause();
        }
      });
      v.addEventListener("play", render);
      v.addEventListener("pause", render);
      render();
      var cap = v.closest("figure").querySelector(".sub__meta");
      if (cap) cap.insertAdjacentElement("afterend", btn);
      if (io) io.observe(v);
    });
  });
})();
