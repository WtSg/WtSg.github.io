---
version: 1
slug: "layouts-gallery-canvas-html"
primary_target: "_layouts/gallery-canvas.html"
related_targets: ["photography/canvas/index.html","assets/css/canvas.css","assets/js/canvas.js"]
---

# Surface brief: photography, endless canvas

Scope: `/photography/canvas/` (`_layouts/gallery-canvas.html`), one of the gallery versions the owner is comparing (kept unlisted with noindex until chosen). The owner's personal photographs ("just my life"). Visitor mode: Experience; the photographs lead. It shares the photo data, the close-up viewer and the studio with the other versions, and has its own visual world, separate from the scientific homepage.

Audience and job: friends, colleagues and visitors from the research site, browsing at leisure on a laptop or phone. They should feel they are looking around a wall of the owner's photographs through a camera, settling on one at a time, and be able to open any of them large.

Proof and content: photos published by the Gallery Studio into `_data/gallery.yml` (id, src, thumb, w, h, title, place, year, optional exif). Most photos have no title, place, year or camera settings; never show file names; never invent settings. Very little text.

Constraints: plain Jekyll as GitHub Pages builds it; photographs stay plain `<img>` elements in their true colours and their own aspect ratios; only the published watermarked copies are shown; no feed-like layout; no WebGL; reduced motion gets instant, still states; without JavaScript the same photographs appear in justified rows.

## Direction contract

THESIS: The gallery is an endless wall of photographs seen through a rangefinder camera's viewfinder. You look around it, and the camera frames, focuses and takes one photograph at a time. It refuses the scrolling grid and the full-screen slideshow.

OWN-WORLD: A near-black wall of photographs that repeats in every direction. A rangefinder viewfinder sits over it: warm bright-line frame corners and a faint full outline, a small yellowish focus patch showing a ghost of the picture, and a red seven-segment LED readout under the frame (DSEG7 digits over their unlit segments, Geist Mono labels) with a three-lamp focus indicator (two arrows and a dot) and a frame counter. Outside the frame lines the wall darkens at rest, as through an eyepiece. Name and footer in Schibsted Grotesk and Geist Mono.

STORY: The camera wakes (every segment and lamp lit for a moment), pulled back over the whole wall, then finds the newest photograph, closes in until it fills the frame and focuses. The visitor drags, scrolls or uses the arrow keys to look around; the faster the wall moves, the further the lens pulls back. When it slows, the nearest photograph is framed and focused. Clicking a photograph frames it and fires the shutter, then opens it large.

FIRST VIEWPORT: Full-bleed dark wall, pulled back to show many photographs; the bright-line frame centred; the LED readout under it showing all segments; then the newest photograph glides into the frame and the lens closes in until it fills it. The name top left (linking home), the photo count top right, a one-line footer with Email me, Homepage and Studio, and a one-line hint under the readout ("Drag to look around · click to open") that fades after the first move.

FORM: Endless canvas (the owner picked it from the brainstorm: "Endless canvas is good"), given the camera mechanism for "visually shocking, better from mechanism, retro and extremely cool". Signature interactions: speed-dependent pull-back; glide-and-close-in framing; a portrait photograph turns the camera, rotating the frame lines a quarter turn; the ghost image slides into register and the focus dot lights; the frame counter rolls like a mechanical counter; a two-curtain focal-plane shutter crosses the screen before the close-up opens. Camera settings show on the LED only when the photograph carries them. Reduced motion shows every state instantly with no inertia, zoom, turn or shutter.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Which gallery version becomes `/photography/` (the owner picks between Darkroom, Darkroom 3D and Endless canvas).
- Whether photos get titles, places, years and camera settings (the studio supports them; the four published photos have none, so the LED shows only the focus lamps and the frame counter).
