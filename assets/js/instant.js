/*
 * Instant prints on the fridge.
 * - Each print slaps onto the door as you reach it; its magnet clacks on.
 * - Then the picture comes up out of murky chemistry, the way instant film does.
 * - Clicking a print takes it off the door (the magnet lets go) to look closely.
 * - Reduced motion: every print is on the door and developed from the start.
 */
(function () {
  "use strict";
  window.__instantLoaded = true;
  var root = document.documentElement;
  var G = window.Gallery || { still: function () { return false; }, open: function () {} };
  var prints = Array.prototype.slice.call(document.querySelectorAll(".ip-print"));
  if (!prints.length) { root.classList.remove("ip-ready"); return; }

  function whenLoaded(img, cb) {
    if (!img || (img.complete && img.naturalWidth)) { cb(); return; }
    var done = false;
    function go() { if (!done) { done = true; cb(); } }
    img.addEventListener("load", go);
    img.addEventListener("error", go);
    if (img.loading === "lazy") img.loading = "eager";
  }

  function settle(li) {
    li.classList.add("is-on", "is-developed");
    li.classList.remove("is-arriving", "is-developing");
  }

  function arrive(li) {
    if (li._on) return;
    li._on = true;
    var img = li.querySelector(".ip-photo img");
    whenLoaded(img, function () {
      if (G.still()) { settle(li); return; }
      li.classList.add("is-on", "is-arriving");
      var finished = false;
      function done() { if (!finished) { finished = true; settle(li); } }
      setTimeout(function () { li.classList.add("is-developing"); }, 680);
      img.addEventListener("animationend", function h(e) {
        if (e.animationName === "emerge") { img.removeEventListener("animationend", h); done(); }
      });
      setTimeout(done, 6000);
    });
  }

  if (G.still() || !("IntersectionObserver" in window)) {
    prints.forEach(settle);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var li = e.target;
        if (document.hidden) {
          document.addEventListener("visibilitychange", function v() {
            if (document.hidden) return;
            document.removeEventListener("visibilitychange", v);
            arrive(li);
          });
        } else {
          // A beat between neighbours so two prints never land at once.
          setTimeout(function () { arrive(li); }, 120 * (prints.indexOf(li) % 2));
        }
      });
    }, { threshold: 0.3 });
    prints.forEach(function (li) { io.observe(li); });
  }

  /* Taking a print off the door to look closely. */
  prints.forEach(function (li, i) {
    var btn = li.querySelector(".ip-open");
    btn.addEventListener("click", function () {
      settle(li);
      li.classList.add("is-lifted");
      var img = li.querySelector(".ip-photo img");
      G.open(i, li.querySelector(".ip-photo"), btn, img.currentSrc || "");
    });
  });
  G.onClose = function (i, moved) {
    prints.forEach(function (li) { li.classList.remove("is-lifted"); });
    if (moved && prints[i]) {
      prints[i].scrollIntoView({ block: "center", behavior: G.still() ? "auto" : "smooth" });
      arrive(prints[i]);
    }
  };
})();
