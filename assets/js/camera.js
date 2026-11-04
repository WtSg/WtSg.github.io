/*
 * The camera, taken apart (photography/camera). Two drawings made by _teardown/rangefinder,
 * each a set of frames that line up exactly (assets/img/teardown):
 *   - the camera coming apart, step by step (a slider, or a drag across the drawing); a tap on
 *     a part, or its name in the list, picks it out, dims the rest and shows it on its own with
 *     what it does (rangefinder-parts.json); Previous and Next walk through every part;
 *   - the rangefinder at work, one frame per distance on the lens's scale, with a small finder
 *     whose second image comes onto the first as the lens reaches the subject.
 * The camera comes apart by itself once, unless less motion is asked for. A part's id in the
 * address (#part-cam) opens the page with it picked out.
 */
(function () {
  "use strict";
  var main = document.querySelector(".cm-main");
  if (!main) return;
  var SRC = main.getAttribute("data-src") || "/assets/img/teardown/";
  var still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var narrow = window.matchMedia ? window.matchMedia("(max-width: 599px)") : { matches: false };
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var data = {}, reqs = {};
  function load(name) {
    if (!reqs[name]) reqs[name] = fetch(SRC + "rangefinder-" + name + ".json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { data[name] = d; return d; }, function () { return null; });
    return reqs[name];
  }

  // A drawing: its figure, two layers to cross-fade, a slider and its reading
  function Drawing(fig, input, output, name, text) {
    this.fig = fig; this.input = input; this.output = output; this.name = name; this.text = text;
    this.layers = fig.querySelectorAll(".cm-layer");
    this.wait = fig.querySelector(".cm-wait");
    this.front = 0; this.key = ""; this.value = +input.value; this.timer = 0; this.onShow = null;
    var self = this;
    input.addEventListener("input", function () { self.stop(); self.show(+input.value, false); });
    // a drag across the drawing moves the slider; a tap is left to the page
    var drag = null;
    fig.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: self.value, moved: false, per: Math.max(22, fig.clientWidth * 0.62 / +input.max) };
    });
    fig.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 7) return;
      if (!drag.moved) {
        if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }   // a scroll, not a drag
        drag.moved = true;
        self.stop();
        try { fig.setPointerCapture(e.pointerId); } catch (x) {}
        fig.classList.add("is-dragging");
      }
      self.show(drag.from + dx / drag.per, true);
    });
    var end = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var tap = !drag.moved;
      drag = null;
      fig.classList.remove("is-dragging");
      if (tap && self.onTap && e.type === "pointerup") self.onTap(e);
    };
    fig.addEventListener("pointerup", end);
    fig.addEventListener("pointercancel", end);
  }
  Drawing.prototype.max = function () { return +this.input.max; };
  Drawing.prototype.svg = function (i) {
    var d = data[this.name];
    return '<svg class="td-rangefinder" viewBox="' + (narrow.matches ? d.inkBox : d.viewBox) + '" role="img" aria-label="' + d.title + '"><title>' + d.title + "</title>" +
      d.frames[i].map(function (k) { return d.groups[k]; }).join("") + (d.labels || "") + "</svg>";
  };
  Drawing.prototype.show = function (i, instant) {
    i = clamp(Math.round(i), 0, this.max());
    this.value = i;
    this.input.value = String(i);
    var t = this.text(i);
    this.output.textContent = t[0];
    this.input.setAttribute("aria-valuetext", t[1]);
    var d = data[this.name];
    this.wait.hidden = !!d;
    if (!d) return;
    var key = i + (narrow.matches ? "n" : "w");
    if (key === this.key) return;
    this.key = key;
    this.front = 1 - this.front;
    var on = this.layers[this.front], off = this.layers[1 - this.front];
    on.innerHTML = this.svg(i);
    this.fig.classList.toggle("is-instant", !!instant || still);
    on.classList.add("is-on");
    off.classList.remove("is-on");
    if (this.onShow) this.onShow(on.querySelector("svg"));
  };
  Drawing.prototype.current = function () { return this.layers[this.front].querySelector("svg"); };
  Drawing.prototype.run = function (to, step, then) {
    var self = this;
    this.stop();
    var tick = function () {
      if (self.value === to) { self.timer = 0; if (then) then(); return; }
      self.show(self.value + (to > self.value ? 1 : -1), false);
      self.timer = setTimeout(tick, step);
    };
    this.timer = setTimeout(tick, 120);
  };
  Drawing.prototype.stop = function () { if (this.timer) clearTimeout(this.timer); this.timer = 0; };
  Drawing.prototype.redraw = function () { this.key = ""; this.show(this.value, true); };

  /* ---------- The camera taken apart, every part picked out ---------- */
  var apart = new Drawing(document.querySelector('[data-fig="apart"]'), document.getElementById("cm-apart"), document.querySelector('output[for="cm-apart"]'), "apart", function (i) {
    var t = i === 0 ? "Together" : i === +document.getElementById("cm-apart").max ? "Apart" : "Coming apart";
    return [t, t.toLowerCase()];
  });
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".cm-part"));
  var order = buttons.map(function (b) { return b.getAttribute("data-part"); });
  var card = document.querySelector(".cm-pick"), cardFig = card.querySelector(".cm-pick__fig");
  var pick = null;

  // light up the picked part and its name in the drawing on show
  function mark(svg) {
    if (!svg) return;
    svg.classList.toggle("has-pick", !!pick);
    Array.prototype.forEach.call(svg.querySelectorAll(".is-pick"), function (el) { el.classList.remove("is-pick"); });
    if (!pick) return;
    Array.prototype.forEach.call(svg.querySelectorAll('[data-item="' + pick + '"], [data-for="' + pick + '"], [data-fill="' + pick + '"]'), function (el) { el.classList.add("is-pick"); });
  }
  apart.onShow = mark;

  function select(id, opts) {
    opts = opts || {};
    pick = id && order.indexOf(id) >= 0 ? id : null;
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-part") === pick ? "true" : "false"); });
    mark(apart.current());
    if (!pick) {
      card.hidden = true;
      if (history.replaceState && /^#part-/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
      return;
    }
    var b = buttons[order.indexOf(pick)];
    card.querySelector(".cm-pick__group").textContent = b.getAttribute("data-group");
    card.querySelector(".cm-pick__h").textContent = b.querySelector("b").textContent;
    card.querySelector(".cm-pick__p").textContent = b.querySelector("span").textContent;
    card.hidden = false;
    cardFig.innerHTML = "";
    load("parts").then(function (d) {
      if (!d || pick !== id) return;
      var p = null;
      for (var k = 0; k < d.parts.length; k++) if (d.parts[k].id === id) p = d.parts[k];
      if (p) cardFig.innerHTML = '<svg class="td-rangefinder" viewBox="' + p.viewBox + '" aria-hidden="true" focusable="false">' + p.markup + "</svg>";
    });
    if (history.replaceState) history.replaceState(null, "", "#part-" + id);
    // half the parts are hidden inside the camera while it is together: take it apart to show it
    if (apart.value < apart.max()) apart.run(apart.max(), still ? 0 : 70);
    if (opts.scroll) {
      var r = apart.fig.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) apart.fig.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    }
  }
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-part");
      select(pick === id ? null : id, { scroll: true });
    });
  });
  card.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-clear")) { select(null); return; }
    var step = +t.getAttribute("data-step");
    if (step) select(order[(order.indexOf(pick) + step + order.length) % order.length]);
  });
  // a tap on the drawing picks the smallest part under the finger, or lets go of the pick
  apart.onTap = function (e) {
    var svg = apart.current();
    if (!svg || !svg.getScreenCTM) return;
    var m = svg.getScreenCTM();
    if (!m) return;
    var pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var q = pt.matrixTransform(m.inverse()), best = null, area = Infinity, slack = 2.5;
    Array.prototype.forEach.call(svg.querySelectorAll("[data-item]"), function (g) {
      var b = g.getBBox();
      if (q.x < b.x - slack || q.x > b.x + b.width + slack || q.y < b.y - slack || q.y > b.y + b.height + slack) return;
      var a = (b.width + 2 * slack) * (b.height + 2 * slack);
      if (a < area) { area = a; best = g.getAttribute("data-item"); }
    });
    select(best && best !== pick ? best : null);
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && pick) select(null);
  });

  load("apart").then(function (d) {
    if (!d) { apart.wait.textContent = "The drawing could not be loaded."; return; }
    var want = /^#part-(.+)$/.exec(location.hash), id = want && order.indexOf(want[1]) >= 0 ? want[1] : null;
    if (id) { apart.show(apart.max(), true); select(id); return; }
    apart.show(still ? apart.max() : 0, true);
    // it comes apart by itself, once, when it is first seen
    if (!still) apart.run(apart.max(), 230);
    setTimeout(function () { load("parts"); }, 1500);
  });

  /* ---------- The rangefinder at work ---------- */
  var focusFig = document.querySelector('[data-fig="action"]');
  var action = new Drawing(focusFig, document.getElementById("cm-focus-at"), document.querySelector('output[for="cm-focus-at"]'), "action", function (i) {
    var d = data.action, st = d ? d.stops[i] : null;
    return st ? [st.label, st.speak] : ["∞", "infinity"];
  });
  var ghost = document.querySelector(".cm-eye__ghost");
  // the patch's second image: off to one side at infinity, on the first at 1 m (the subject's
  // distance), off the other way nearer still
  action.onShow = function () {
    var d = data.action, v = d ? d.stops[action.value].v : 0;
    ghost.setAttribute("transform", "translate(" + (0.3 * (v - 1) * 44).toFixed(2) + " 0)");
    ghost.style.transform = "translateX(" + (0.3 * (v - 1) * 44).toFixed(2) + "px)";
  };
  action.onShow();
  var seen = false;
  function startAction() {
    if (seen) return;
    seen = true;
    load("action").then(function (d) {
      if (!d) { action.wait.textContent = "The drawing could not be loaded."; return; }
      action.show(0, true);
      // the first time it is seen, the lens focuses by itself from infinity to the subject
      if (!still) action.run(d.subject, 200);
      else action.show(d.subject, true);
    });
  }
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { startAction(); io.disconnect(); } });
    }, { rootMargin: "300px 0px" });
    io.observe(focusFig);
  } else startAction();

  /* ---------- The light through the lens: aperture, then focusing ---------- */
  // the lens's distance scale, in millimetres from the film (the rangefinder's own stops)
  var DIST = [[Infinity, "∞", "infinity"], [10000, "10 m", "10 metres"], [5000, "5 m", "5 metres"], [3000, "3 m", "3 metres"], [2000, "2 m", "2 metres"],
    [1500, "1.5 m", "1.5 metres"], [1200, "1.2 m", "1.2 metres"], [1000, "1 m", "1 metre"], [900, "0.9 m", "0.9 metres"], [800, "0.8 m", "0.8 metres"], [700, "0.7 m", "0.7 metres"]];
  var SUBJECT = 1000, SUBJECT_STOP = 7;
  var lensFigs = {}, lensData = null;
  // a slider, and a drag across its figure that moves it
  function dragSlider(fig, input, onChange) {
    var drag = null;
    fig.addEventListener("pointerdown", function (e) { if (!e.button) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: +input.value, moved: false, per: Math.max(22, fig.clientWidth * 0.62 / +input.max) }; });
    fig.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 7) return;
      if (!drag.moved) {
        if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }
        drag.moved = true;
        try { fig.setPointerCapture(e.pointerId); } catch (x) {}
      }
      var v = clamp(Math.round(drag.from + dx / drag.per), 0, +input.max);
      if (v !== +input.value) { input.value = String(v); onChange(v, true); }
    });
    var end = function (e) { if (drag && e.pointerId === drag.id) drag = null; };
    fig.addEventListener("pointerup", end);
    fig.addEventListener("pointercancel", end);
    input.addEventListener("input", function () { onChange(+input.value, false); });
  }
  function lensFigure(kind) {
    var host = document.querySelector('[data-lens="' + kind + '"]');
    if (!host || !lensData || !window.CameraLens) return null;
    var draw = host.querySelector(".cm-lens__draw"), eyeHolder = host.querySelector(".cm-lens__eye");
    draw.innerHTML = "";
    var stops = window.CameraLens.STOPS;
    if (kind === "aperture") {
      var inA = document.getElementById("cm-stop"), outA = document.querySelector('output[for="cm-stop"]');
      var fa = window.CameraLens.figure(draw, lensData, { subject: SUBJECT, focus: SUBJECT, stop: 2, inset: "cm-lens-a", insetHolder: eyeHolder, still: still });
      var showA = function (i) { var N = stops[i]; outA.textContent = "f/" + N; inA.setAttribute("aria-valuetext", "f/" + N); fa.set({ stop: N }); };
      dragSlider(host, inA, showA);
      showA(+inA.value);
      return fa;
    }
    var inF = document.getElementById("cm-focus-lens"), outF = document.querySelector('output[for="cm-focus-lens"]');
    var ff = window.CameraLens.figure(draw, lensData, { subject: SUBJECT, focus: Infinity, stop: 2, inset: "cm-lens-f", insetHolder: eyeHolder, still: still });
    var timer = 0;
    var showF = function (i, fromUser) {
      if (fromUser !== undefined && timer) { clearTimeout(timer); timer = 0; }
      var d = DIST[i]; outF.textContent = d[1]; inF.setAttribute("aria-valuetext", d[2]); ff.set({ focus: d[0] });
    };
    dragSlider(host, inF, showF);
    showF(+inF.value);
    // the first time it is seen, the lens focuses by itself from infinity to the subject
    ff.play = function () {
      if (still) { inF.value = String(SUBJECT_STOP); showF(SUBJECT_STOP); return; }
      var tick = function () {
        var i = +inF.value;
        if (i >= SUBJECT_STOP) { timer = 0; return; }
        inF.value = String(i + 1); showF(i + 1);
        timer = setTimeout(tick, 380);
      };
      timer = setTimeout(tick, 500);
    };
    ff.stop = function () { if (timer) clearTimeout(timer); timer = 0; };
    ff.playing = function () { return !!timer; };
    return ff;
  }
  function startLens() {
    if (lensData) return;
    fetch(SRC + "lens.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      lensData = d;
      lensFigs.aperture = lensFigure("aperture");
      lensFigs.focus = lensFigure("focus");
      watch(document.querySelector('[data-lens="focus"]'), function () { if (lensFigs.focus) lensFigs.focus.play(); }, "0px");
    }, function () {});
  }

  /* ---------- Taking the picture: the shutter and the film ---------- */
  var shutterFig = document.querySelector('[data-fig="shutter"]');
  function startShutter() {
    fetch(SRC + "shutter.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      data.shutterFig = d;
      drawShutter();
    }, function () {});
  }
  function drawShutter() {
    var d = data.shutterFig;
    if (!d) return;
    shutterFig.innerHTML = '<svg class="td-rangefinder" viewBox="' + (narrow.matches ? d.inkBox : d.viewBox) + '" role="img" aria-label="' + d.title + '"><title>' + d.title + "</title>" + d.markup + "</svg>";
  }

  // each drawing loads when it comes near
  function watch(el, fn, margin) {
    if (!el) return;
    if (!window.IntersectionObserver) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: (margin || "400px") + " 0px" });
    io.observe(el);
  }
  watch(document.querySelector('[data-lens="aperture"]'), startLens);
  watch(shutterFig, startShutter);

  // the names leave the drawings on narrow screens, and the drawings crop closer
  var onNarrow = function () { apart.redraw(); if (data.action) action.redraw(); drawShutter(); };
  if (narrow.addEventListener) narrow.addEventListener("change", onNarrow);
  else if (narrow.addListener) narrow.addListener(onNarrow);

  // for tests
  window.CameraPage = {
    apart: function () { return { value: apart.value, out: apart.output.textContent, loaded: !!data.apart, playing: !!apart.timer, texts: (apart.current() || apart.fig).querySelectorAll("text").length }; },
    action: function () { return { value: action.value, out: action.output.textContent, loaded: !!data.action, playing: !!action.timer, ghost: ghost.getAttribute("transform") }; },
    pick: function () { return { id: pick, card: !card.hidden, title: card.querySelector(".cm-pick__h").textContent, drawn: !!cardFig.querySelector("svg"), lit: (apart.current() || apart.fig).querySelectorAll('.is-pick').length }; },
    lens: function (k) { var f = lensFigs[k]; return f ? f.state() : null; },
    lensPlaying: function () { return !!(lensFigs.focus && lensFigs.focus.playing()); },
    shutter: function () { var svg = shutterFig.querySelector("svg"); return { loaded: !!svg, parts: svg ? svg.querySelectorAll("[data-item]").length : 0 }; },
    stop: function () { apart.stop(); action.stop(); if (lensFigs.focus) lensFigs.focus.stop(); }
  };
})();
