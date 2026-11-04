---
version: 1
slug: "layouts-camera-html"
primary_target: "_layouts/camera.html"
related_targets: ["photography/camera/index.html","_data/camera_parts.yml","assets/css/camera.css","assets/js/camera.js","_teardown/rangefinder/exploded.js","_teardown/rangefinder/model.js","_teardown/rangefinder/build-frames.cjs","assets/img/teardown/rangefinder-apart.json","assets/img/teardown/rangefinder-parts.json","assets/img/teardown/rangefinder-action.json"]
---

# Surface brief: the camera, taken apart

Scope: `/photography/camera/` (`_layouts/camera.html`), a page of the photography section: a Leica M-style rangefinder camera taken apart, every part with what it does, and the rangefinder at work. The owner: "add a particular page to teardown the Leica camera for every part in my web, so it's not in this challenge". Visitor mode: Experience; the drawings lead. Linked from the wall's header ("The camera, taken apart") and from the focus challenge's guide (its step "Inside the camera").

Audience and job: friends, colleagues and visitors to the photography pages, mostly on a phone (the owner reviews on an iPhone). They should be able to take the camera apart, pick out any part and read what it does, then see how turning the lens tells the rangefinder where it is focused.

Proof and content: technical illustrations made with the teardown skill (`_teardown/rangefinder`, evidence in its `evidence.md`): illustrations of the classic rangefinder layout, not any one camera's construction, with no maker's name or mark. The part descriptions (`_data/camera_parts.yml`) say what each part is for, with no specifications, materials or one camera's construction. No photographs on this page. "Leica M-style" in the text only; the URL and file names say "camera".

Constraints: plain Jekyll as GitHub Pages builds it; no WebGL; the page zooms; drawings are pre-rendered frames (JSON) swapped by sliders, their lines the same width on screen at any size; reduced motion gets still states and no auto-play; without JavaScript every part is still listed with its text.

## Direction contract

THESIS: A real teardown on the photography pages' dark ground: the camera comes apart in your hands, and any part can be picked out and read about, one at a time or all the way through.

OWN-WORLD: The photography pages' near-black ground, Schibsted Grotesk and Geist Mono. Fine light ink for the drawings; amber for what moves when the lens is focused; pale blue for glass; the LED red for light and the subject; the see-through shells dimmed; a pale gold for the part picked out.

LAYOUT (phone first): the name and Photography at the top; the title, a line on what the page is, and the note that it is an illustration seen from behind. Then the camera taken apart: a "Take it apart" slider over the drawing (Together, Coming apart, Apart); a drag across the drawing does the same; a tap on a part, or its name in the list, picks it out (the rest dims, it and its name light up) and shows a card under the drawing (beside it on a wide screen) with the part drawn on its own, its group, its name, what it does, Previous and Next through every part, and All parts; Escape lets go; the address names the part (#part-cam) so it can be shared. The camera comes apart by itself once when the page opens. On a phone the drawing carries no names (the list does) and fills the width. "Every part" lists the 25 parts in five groups (the top, the finder, the rangefinder, the body, the lens), each a button with its name and text. "How it focuses": a paragraph, a small finder (frame corners, the patch, a post and its second image, in the patch, sliding as the lens turns) beside a "Lens focused at" slider over the lens's scale (∞ to 0.7 m), and the drawing of the rangefinder at work (the camera from behind, its shell see-through, the lens moving out, the roller following the cam, the levers swinging the mirror, the rangefinder's line of sight crossing the viewfinder's where the lens is focused, on the subject at 1 m); it loads when it comes near and, the first time, focuses by itself from infinity to the subject. Not to scale: angles nine times their size, the lens's travel nearly twice. Footer: the year and name, a credit for the teardown skill, Email me, Photography, Homepage.

WEIGHT: the camera taken apart loads at once (about 330 KB compressed), every part on its own soon after (about 70 KB), the rangefinder at work only when its section comes near (about 330 KB).
