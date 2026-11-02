/*
 * Photography: the darkroom.
 * - Each print develops in its tray when you reach it (blank paper, shadows
 *   first, then full tones, with ripples through the developer), then a copy
 *   flies up to the drying line and swings on its clothespin.
 * - The IN USE sign is the light switch: the room flickers on and every print
 *   glides from its tray onto the bench (View Transitions where supported).
 * - Opening a print lifts it out of the tray to look at closely.
 * - With reduced motion, every state appears at once.
 */
(function () {
  "use strict";
  window.__darkroomLoaded = true;

  var root = document.documentElement;
  var body = document.body;
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; }
  var reduce = mq("(prefers-reduced-motion: reduce)");
  var fine = mq("(hover: hover) and (pointer: fine)");
  function still() { return reduce.matches; }

  // Owner-only shortcut: on a device that has connected the Gallery Studio, show
  // "Add photos". The marker holds no secret; visitors never have it.
  try {
    if (localStorage.getItem("gallery-studio-owner") === "1") {
      var add = document.querySelector(".dr-add");
      if (add) add.hidden = false;
    }
  } catch (e) {}

  // Light friction against casual saving; the real protection is that only
  // 2000 px watermarked copies are ever published.
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest(".print, .pin__print, .loupe__img, .flyer")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  var trays = Array.prototype.slice.call(document.querySelectorAll(".tray[data-index]"));
  if (!trays.length) { root.classList.remove("dr-ready"); return; }

  var line = document.querySelector(".dr-line");
  var pinList = line ? line.querySelector(".dr-line__pins") : null;
  var pins = pinList ? Array.prototype.slice.call(pinList.children) : [];
  var agitate = document.getElementById("agitate-run");
  var DEV_MS = 2800;
  var DEV_SHOWN = 90; // the tray timer reads 1:30 when a print is done

  function lightsOn() { return body.getAttribute("data-lights") === "on"; }
  function ms(n) { return still() ? 0 : n; }

  /* ---------- The drying line sags: hang each pin on the curve ---------- */
  // The wire is the quadratic M0 8 Q500 34 1000 8 drawn 40 px tall, so at a
  // fraction f along it the wire sits 52 f (1 - f) px below its ends.
  var sagQueued = false;
  // Size the clothespinned prints so every one fits on the visible line.
  function fitPins() {
    if (!pinList || !pins.length) return;
    var cs = getComputedStyle(pinList);
    var avail = pinList.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (avail <= 0) return;
    var gap = parseFloat(cs.columnGap) || 0;
    var sum = 0;
    pins.forEach(function (p) { sum += parseFloat(p.style.getPropertyValue("--ar")) || 1; });
    var h = (avail - pins.length * 6 - (pins.length - 1) * gap - 2) / sum;
    line.style.setProperty("--pin-fit", Math.max(16, Math.floor(h)) + "px");
    line.classList.toggle("is-crowded", h < 16);
  }
  function sag() {
    sagQueued = false;
    if (!line) return;
    fitPins();
    var lr = line.getBoundingClientRect();
    if (!lr.width) return;
    pins.forEach(function (p) {
      var r = p.getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (r.left + r.width / 2 - lr.left) / lr.width));
      p.style.setProperty("--sag", (52 * f * (1 - f)).toFixed(1) + "px");
    });
  }
  function queueSag() {
    if (sagQueued) return;
    sagQueued = true;
    requestAnimationFrame(sag);
  }
  sag();
  window.addEventListener("resize", queueSag);
  if (pinList) pinList.addEventListener("scroll", queueSag, { passive: true });

  /* ---------- Developing ---------- */
  function whenLoaded(img, cb) {
    if (!img || (img.complete && img.naturalWidth)) { cb(); return; }
    var done = false;
    function go() { if (!done) { done = true; cb(); } }
    img.addEventListener("load", go);
    img.addEventListener("error", go);
    if (img.loading === "lazy") img.loading = "eager";
  }

  function setTimer(t, s) {
    var el = t.querySelector("[data-timer]");
    if (el) el.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }
  function runTimer(t) {
    var start = null;
    function f(now) {
      if (start === null) start = now;
      var p = Math.min(1, (now - start) / DEV_MS);
      setTimer(t, Math.round(p * DEV_SHOWN));
      if (p < 1 && t.classList.contains("is-developing")) requestAnimationFrame(f);
      else setTimer(t, DEV_SHOWN);
    }
    requestAnimationFrame(f);
  }

  function finish(t, fly) {
    if (t.classList.contains("is-developed")) return;
    t.classList.remove("is-developing");
    t.classList.add("is-developed");
    setTimer(t, DEV_SHOWN);
    hang(+t.getAttribute("data-index"), fly);
  }

  function develop(t) {
    if (t._dev) return;
    t._dev = true;
    var img = t.querySelector(".print__img");
    whenLoaded(img, function () {
      if (t.classList.contains("is-developed")) return;
      if (still() || lightsOn()) { finish(t, false); return; }
      // A beat of blank paper in the tray before the image starts to come up.
      setTimeout(function () { if (!t.classList.contains("is-developed")) start(t, img); }, 450);
    });
  }

  function start(t, img) {
    t.classList.add("is-developing");
    if (fine.matches && agitate && agitate.beginElement) {
      try { agitate.beginElement(); } catch (e) {}
    }
    runTimer(t);
    var over = false;
    function end() { if (!over) { over = true; finish(t, true); } }
    img.addEventListener("animationend", function h(e) {
      if (e.animationName === "develop") { img.removeEventListener("animationend", h); end(); }
    });
    setTimeout(end, DEV_MS + 900);
  }

  /* ---------- Hanging on the line ---------- */
  function revealPin(pin) {
    pin.classList.add("has-print");
    var b = pin.querySelector(".pin__print");
    if (b) b.tabIndex = 0;
  }

  function hang(i, fly) {
    var pin = pins[i];
    if (!pin || pin.classList.contains("has-print")) return;
    var target = pin.querySelector(".pin__print");
    var print = trays[i].querySelector(".print");
    if (!fly || still() || lightsOn() || !target || !print || !target.animate) { revealPin(pin); return; }

    // Bring the pin into the visible part of the line first.
    if (pinList && pinList.scrollWidth > pinList.clientWidth) {
      var pl = pinList.getBoundingClientRect(), pr = pin.getBoundingClientRect();
      if (pr.left < pl.left || pr.right > pl.right) {
        pinList.scrollLeft += pr.left - pl.left - (pl.width - pr.width) / 2;
        sag();
      }
    }

    var from = print.getBoundingClientRect();
    var to = target.getBoundingClientRect();
    if (!to.width || !from.width || from.bottom < 0 || from.top > window.innerHeight) { revealPin(pin); return; }

    var flyer = document.createElement("div");
    flyer.className = "flyer";
    flyer.setAttribute("aria-hidden", "true");
    var im = target.querySelector("img").cloneNode(false);
    im.removeAttribute("loading");
    im.alt = "";
    flyer.appendChild(im);
    flyer.style.width = to.width + "px";
    flyer.style.height = to.height + "px";
    body.appendChild(flyer);

    var sx = from.width / to.width, sy = from.height / to.height;
    function at(x, y, scx, scy, rot) {
      return "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + scx.toFixed(4) + "," + scy.toFixed(4) + ") rotate(" + rot + "deg)";
    }
    // Peel up out of the tray, arc towards the pin, overshoot, settle.
    var midS = Math.sqrt(sx), midSy = Math.sqrt(sy);
    var mx = from.left + (to.left - from.left) * 0.55 - 30;
    var my = Math.min(from.top, to.top) + (from.top - to.top) * 0.25 - 40;
    var anim = flyer.animate([
      { transform: at(from.left, from.top, sx, sy, 0), opacity: 1 },
      { transform: at(from.left - from.width * 0.012, from.top - 14, sx * 1.025, sy * 1.025, -1.5), offset: 0.14 },
      { transform: at(mx, my, midS, midSy, -9), offset: 0.55 },
      { transform: at(to.left, to.top + 6, 1, 1, 7), offset: 0.88 },
      { transform: at(to.left, to.top, 1, 1, 0) }
    ], { duration: 1150, easing: "cubic-bezier(.45,0,.2,1)" });
    var landed = false;
    function land() {
      if (landed) return;
      landed = true;
      flyer.remove();
      revealPin(pin);
      pin.classList.add("is-swinging");
      setTimeout(function () { pin.classList.remove("is-swinging"); }, 2000);
    }
    anim.onfinish = land;
    anim.oncancel = land;
  }

  /* ---------- Reaching a tray develops it ---------- */
  var io = null;
  function settleAll() {
    trays.forEach(function (t) {
      t._dev = true;
      t.classList.remove("is-developing");
      t.classList.add("is-developed");
      setTimer(t, DEV_SHOWN);
    });
    pins.forEach(revealPin);
    if (io) { io.disconnect(); io = null; }
  }

  if (still() || !("IntersectionObserver" in window)) {
    settleAll();
  } else {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var t = e.target.closest(".tray");
        if (io) io.unobserve(e.target);
        if (document.hidden) {
          document.addEventListener("visibilitychange", function v() {
            if (document.hidden) return;
            document.removeEventListener("visibilitychange", v);
            develop(t);
          });
        } else {
          develop(t);
        }
      });
    }, { threshold: 0.45 });
    trays.forEach(function (t) { io.observe(t.querySelector(".print")); });
  }
  if (reduce.addEventListener) {
    reduce.addEventListener("change", function () { if (still()) settleAll(); });
  }

  /* ---------- Pins: go to the tray (or open the print with the lights on) ---------- */
  pins.forEach(function (p, i) {
    var b = p.querySelector(".pin__print");
    if (!b) return;
    b.addEventListener("click", function () {
      if (lightsOn()) { openLoupe(i, b); return; }
      trays[i].scrollIntoView({ behavior: still() ? "auto" : "smooth", block: "center" });
      var o = trays[i].querySelector(".print__open");
      if (o) o.focus({ preventScroll: true });
    });
  });

  /* ---------- The light switch ---------- */
  var toggle = document.querySelector("[data-lights-toggle]");
  var hint = toggle ? toggle.querySelector("[data-sign-hint]") : null;
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var flicker = document.querySelector(".dr-flicker");
  var staggerSheet = document.createElement("style");
  document.head.appendChild(staggerSheet);
  var switching = false;

  function setLights(on) {
    body.setAttribute("data-lights", on ? "on" : "safe");
    if (hint) hint.textContent = on ? "Safelight" : "Lights on";
    if (themeMeta) themeMeta.setAttribute("content", on ? "#a3a4a0" : "#170605");
    settleAll();
    if (flicker) flicker.classList.remove("is-on");
    window.scrollTo(0, 0);
    sag();
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (switching) return;
      var on = !lightsOn();
      // Start fetching every print now so the bench is full when the light comes up.
      trays.forEach(function (t) {
        var im = t.querySelector(".print__img");
        if (im && im.loading === "lazy") im.loading = "eager";
      });
      if (still()) { setLights(on); return; }

      switching = true;
      function go() {
        if (!document.startViewTransition) {
          setLights(on);
          switching = false;
          return;
        }
        // Prints leave their trays one after another.
        var css = "";
        trays.forEach(function (t, i) {
          css += "::view-transition-group(print-" + (i + 1) + "){animation-delay:" + Math.min(i * 45, 540) + "ms}";
        });
        staggerSheet.textContent = css;
        var vt = document.startViewTransition(function () { setLights(on); });
        var clear = function () { staggerSheet.textContent = ""; switching = false; };
        vt.finished.then(clear, clear);
      }
      if (on && flicker) {
        flicker.classList.add("is-on");
        setTimeout(go, 560);
      } else {
        go();
      }
    });
  }

  /* ---------- The loupe ---------- */
  var dialog = document.querySelector(".loupe");
  var openLoupe = function () {};
  if (dialog && typeof dialog.showModal === "function") {
    var stage = dialog.querySelector(".loupe__stage");
    var lImg = dialog.querySelector(".loupe__img");
    var lTape = dialog.querySelector(".loupe__tape");
    var lSpec = dialog.querySelector(".loupe__spec");
    var lCount = dialog.querySelector(".loupe__count");
    var index = 0, openedAt = 0, opener = null, closing = false;

    var fill = function (i) {
      var t = trays[i];
      var tImg = t.querySelector(".print__img");
      var full = t.getAttribute("data-full");
      lImg.style.setProperty("--ar", t.style.getPropertyValue("--ar"));
      lImg.alt = tImg.alt;
      // Show what is already decoded at once, then swap in the full copy.
      lImg.src = tImg.currentSrc || full;
      if (lImg.src.indexOf(full) === -1) {
        var pre = new Image();
        pre.onload = function () { if (index === i && dialog.open) lImg.src = full; };
        pre.src = full;
      }
      var tape = t.querySelector(".tape");
      lTape.innerHTML = tape ? tape.innerHTML : "";
      var spec = t.querySelector(".spec");
      lSpec.innerHTML = spec ? spec.innerHTML : "";
      lSpec.hidden = !spec || !spec.children.length;
      lCount.textContent = (i + 1) + " / " + trays.length;
      [i + 1, i - 1].forEach(function (k) {
        var q = trays[(k + trays.length) % trays.length];
        var n = new Image();
        n.src = q.getAttribute("data-full");
      });
    };

    openLoupe = function (i, from) {
      index = openedAt = i;
      opener = from;
      closing = false;
      fill(i);
      dialog.showModal();
      if (still() || !lImg.animate) return;
      var srcEl = (from && from.querySelector("img")) || from;
      var r0 = srcEl ? srcEl.getBoundingClientRect() : null;
      lImg.style.opacity = "0";
      requestAnimationFrame(function () {
        lImg.style.opacity = "";
        var r1 = lImg.getBoundingClientRect();
        if (!r0 || !r0.width || !r1.width) return;
        var dx = (r0.left + r0.width / 2) - (r1.left + r1.width / 2);
        var dy = (r0.top + r0.height / 2) - (r1.top + r1.height / 2);
        var s = r0.width / r1.width;
        // Lifted out of the tray towards you, tilting as it comes up, then set down.
        lImg.animate([
          { transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")", boxShadow: "0 0 0 rgba(0,0,0,0)" },
          { transform: "translateY(-1.4rem) scale(1.035) rotateX(7deg)", boxShadow: "0 2.6rem 3.6rem -1.2rem rgba(0,0,0,.5)", offset: 0.62 },
          { transform: "none" }
        ], { duration: 820, easing: "cubic-bezier(.2,.75,.25,1)" });
      });
    };

    var closeLoupe = function () {
      if (!dialog.open || closing) return;
      if (still() || !dialog.animate) { dialog.close(); return; }
      closing = true;
      var a = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" });
      a.onfinish = function () { dialog.close(); };
    };

    var step = function (d) {
      var n = (index + d + trays.length) % trays.length;
      if (still() || !lImg.animate) { index = n; fill(n); return; }
      var out = lImg.animate([
        { transform: "none", opacity: 1 },
        { transform: "translateX(" + (-d * 4) + "%) rotate(" + (-d * 1.2) + "deg)", opacity: 0 }
      ], { duration: 170, easing: "ease-in", fill: "forwards" });
      out.onfinish = function () {
        index = n;
        fill(n);
        out.cancel();
        lImg.animate([
          { transform: "translateX(" + (d * 4) + "%) rotate(" + (d * 1.2) + "deg)", opacity: 0 },
          { transform: "none", opacity: 1 }
        ], { duration: 340, easing: "cubic-bezier(.2,.8,.2,1)" });
      };
    };

    trays.forEach(function (t, i) {
      var b = t.querySelector(".print__open");
      if (b) b.addEventListener("click", function () { openLoupe(i, b); });
    });

    dialog.addEventListener("click", function (e) {
      var act = e.target.closest("[data-loupe]");
      if (act) {
        var a = act.getAttribute("data-loupe");
        if (a === "prev") step(-1);
        else if (a === "next") step(1);
        else closeLoupe();
        return;
      }
      if (e.target === dialog || e.target === stage) closeLoupe();
    });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });
    dialog.addEventListener("cancel", function (e) {
      if (!still()) { e.preventDefault(); closeLoupe(); }
    });

    var sx0 = null;
    stage.addEventListener("pointerdown", function (e) { sx0 = e.clientX; });
    stage.addEventListener("pointerup", function (e) {
      if (sx0 === null) return;
      var dx = e.clientX - sx0;
      sx0 = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });

    dialog.addEventListener("close", function () {
      closing = false;
      // If you browsed to another print, come back to its tray.
      if (index !== openedAt) {
        var t = trays[index];
        if (!lightsOn()) t.scrollIntoView({ block: "center" });
        var o = t.querySelector(".print__open");
        if (o) o.focus({ preventScroll: true });
      } else if (opener && opener.focus) {
        opener.focus({ preventScroll: true });
      }
    });
  }
})();
