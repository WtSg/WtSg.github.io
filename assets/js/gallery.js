/*
 * Photography gallery: a viewer for the larger image, plus light friction against
 * casual saving (no dragging, no long-press menu or right-click menu on photos).
 * These only deter casual copying; the real protection is that only 2000px,
 * watermarked copies are ever published.
 */
(function () {
  "use strict";

  var photos = Array.prototype.slice.call(document.querySelectorAll(".photo"));
  var dialog = document.querySelector(".lightbox");

  // Light friction on photographs only; the rest of the page behaves normally.
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest(".photo img, .lightbox img, .photo-strip img")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  if (!photos.length || !dialog || typeof dialog.showModal !== "function") return;

  var img = dialog.querySelector(".lightbox__img");
  var cap = dialog.querySelector(".lightbox__cap");
  var count = dialog.querySelector(".lightbox__count");
  var index = 0;
  var opener = null;

  function show(n) {
    index = (n + photos.length) % photos.length;
    var p = photos[index];
    var thumb = p.querySelector("img");
    img.src = p.getAttribute("data-full");
    img.alt = thumb ? thumb.alt : "";
    img.width = parseInt(p.getAttribute("data-w"), 10) || 0;
    img.height = parseInt(p.getAttribute("data-h"), 10) || 0;
    var fc = p.querySelector("figcaption");
    cap.innerHTML = fc ? fc.innerHTML : "";
    count.textContent = (index + 1) + " of " + photos.length;
    // Preload the neighbours so Next and Previous feel immediate.
    [index + 1, index - 1].forEach(function (k) {
      var q = photos[(k + photos.length) % photos.length];
      var pre = new Image();
      pre.src = q.getAttribute("data-full");
    });
  }

  photos.forEach(function (p, i) {
    var btn = p.querySelector(".photo__open");
    btn.addEventListener("click", function () {
      opener = btn;
      show(i);
      dialog.showModal();
    });
  });

  dialog.addEventListener("click", function (e) {
    var action = e.target.closest("[data-lb]");
    if (action) {
      var a = action.getAttribute("data-lb");
      if (a === "prev") show(index - 1);
      else if (a === "next") show(index + 1);
      else dialog.close();
      return;
    }
    // A click on the backdrop (the dialog box itself, outside the figure and controls) closes it.
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
  });

  dialog.addEventListener("close", function () {
    img.removeAttribute("src");
    if (opener) opener.focus();
  });
})();
