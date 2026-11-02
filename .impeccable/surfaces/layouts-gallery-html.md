---
version: 1
slug: "layouts-gallery-html"
primary_target: "_layouts/gallery.html"
related_targets: ["photography/index.html"]
---

# Surface brief: photography gallery

Scope: `/photography/` (`_layouts/gallery.html`), the owner's personal photographs ("just my life"). Visitor mode: Experience; the photographs lead. This surface has its own visual world, separate from the scientific homepage; the homepage keeps its own style.

Audience and job: friends, colleagues and visitors from the research site, browsing at leisure on a laptop or phone. They should feel they are walking through the owner's photographs one at a time, then be able to see everything at once.

Proof and content: photos published by the Gallery Studio into `_data/gallery.yml` (id, src, thumb, w, h, title, place, year, optional exif). Most photos have no title; never show file names. Very little text.

Constraints: plain Jekyll as GitHub Pages builds it; photos keep their true colours and their own aspect ratios; only the published 2000 px watermarked copies are shown; no feed-like layout; reduced motion gets instant, still states.

## Direction contract

THESIS: The gallery is a darkroom. Each photograph develops in a tray as you reach it, then hangs on the drying line. It refuses the white portfolio grid and the black full-screen slideshow.

OWN-WORLD: A safelight-red room (near-black red ground, one safelight pool of light), developer trays with dark rims and a liquid sheen, bright photo-paper prints with white borders, a sagging wire drying line with wooden clothespins, masking-tape labels written in grease pencil (Permanent Marker), darkroom signage and timer labels in a condensed industrial sans (Barlow Condensed). Lights on: the same room under white fluorescent light, neutral grey.

STORY: The visitor watches the newest photograph develop, scrolls to develop the next, and sees the line fill with prints. One switch turns the lights on to see every print together; any print can be lifted out to look at closely.

FIRST VIEWPORT: Full-bleed safelight room. Across the top, a sagging drying line with empty clothespins. Top right, a lit "IN USE" darkroom sign that is the Lights switch; top left, a small wordmark linking home. Centre, a developer tray holding the newest print at about 68% of the viewport height, developing from blank paper to the full image while the liquid ripples. A strip of masking tape on the tray rim carries the caption and a small camera line.

FORM: Darkroom, position 7 on the ordered list (the roll's assignment; the owner chose it over the photo book). seed:3dd51f063d134797. Signature interactions: develop-in-tray on scroll (blank paper, shadows first, then full tones, with surface ripples); the finished print flies to the drying line and swings on its pin; the Lights switch flickers the room on and lays out every print; opening a print lifts it toward the viewer. Reduced motion shows every state instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Whether photos get titles, places and years (the studio supports them; most are blank now).
