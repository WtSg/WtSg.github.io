---
version: 1
slug: "layouts-gallery-html"
primary_target: "_layouts/gallery.html"
related_targets: ["photography/index.html","photography/darkroom-3d/index.html","assets/js/darkroom3d.js","assets/js/darkroom.js","assets/css/darkroom.css"]
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

FIRST VIEWPORT (revised by the owner: "display a developing table dark room and my photo in the table", then "add more operation like in the darkroom" and "the far room can be endless as well"; built in WebGL where available): the page opens on a real-time 3D darkroom bench under a red safelight, at the front of a drying room that goes on without end: behind a low tiled splash-back, rows of drying lines hung with prints recede into the dark, each pair of rows under hanging safelights that throw pools of red light, until the fog takes them. On the bench: a paper safe, the enlarger and its easel with a red seven-segment exposure timer, developer / stop / fixer trays, tongs, chemistry bottles, and the luminous darkroom clock; the drying line hangs over the bench. Each print is made the way a darkroom makes it, every step on the scroll and reversible, played at a steady pace (revised by the owner: "when I scroll down it's too fast so the animation is not consistent"): slow scrubbing is followed closely, but a flick of the page plays the step through in about five seconds instead of skipping it, hurrying only to make up a long way: a sheet comes out of the paper safe onto the easel, the enlarger projects the colour negative onto it (a warm beam with dust in it, the timer counting down), the sheet slides into the developer and comes up under ripples, the tongs carry it through the stop bath and the fixer, and it is clipped to the line and swings. After the last print one more step of the scroll takes it to the line as well and pulls back to the whole line, with a one-time note that the lights can come on (revised by the owner: "for the 4 photo i cannot drag anymore"). The camera follows the print along the bench, up to the line and back to the enlarger, and the hand-off from one print to the next is one glide (the owner: "when we are at the end of each image the transition to the next one is super not smooth"): every move starts where the last ended, the camera turns to whatever moves gently and gently back, it rides a damped spring so it gathers speed and slows down without a lurch, and where it has a long way to go across the room (a print going up to the far end of the line, the enlarger after it) the process slows so the camera never goes faster than about 3 m/s; the next print's full picture is made ready on the GPU while the scene stands still, so the hand-off never waits on it. By hand: drag a tray to rock it, from the print lying in it too (the developer runs from end to end; a click on the print still opens it), brush or flick a hanging print to swing it, press the enlarger or its timer to switch the lamp on and see the negative; touch gets taps. Lights on catches the fluorescent tubes row after row down the endless room and lifts the camera into it: drag (or scroll) to wander along and between the lines, click any print to look closely. The wordmark sits top left and the IN USE sign (the switch) top right. A masking-tape caption and a timer that names the step (Exp, Dev, Stop, Fix, Dry) sit over the scene. Where WebGL or import maps are missing, or the GPU draws the room black (the scene checks its first frames and gives up effects one at a time first), the flat darkroom below is the fallback.

FIRST VIEWPORT, flat fallback: Full-bleed safelight room. Across the top, a sagging drying line with empty clothespins. Top right, a lit "IN USE" darkroom sign that is the Lights switch; top left, a small wordmark linking home. Centre, a developer tray holding the newest print at about 68% of the viewport height, developing from blank paper to the full image while the liquid ripples. A strip of masking tape on the tray rim carries the caption and a small camera line.

FORM: Darkroom, position 7 on the ordered list (the roll's assignment; the owner chose it over the photo book, and kept the 3D version over the other variants). seed:3dd51f063d134797. Signature interactions: expose under the enlarger (the negative projected on the paper); develop-in-tray on scroll (blank paper, shadows first, then full tones, with surface ripples); through stop and fixer in the tongs; the finished print is clipped to the drying line and swings; rock a tray by hand; the Lights switch flickers the tubes on row by row down the endless room; opening a print lifts it toward the viewer. Reduced motion shows every state instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Whether photos get titles, places and years (the studio supports them; most are blank now).
