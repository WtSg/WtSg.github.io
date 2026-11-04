# Evidence: how a rangefinder focuses, and the camera taken apart

Two drawings for the page "The camera, taken apart" (photography/camera, linked from the
photography wall and from the focus challenge's guide), both of a Leica M-style camera, both
illustrative concepts: no reference
drawing, CAD model or teardown of a specific camera was supplied, so the construction follows the
classic layout of a coincident-image rangefinder camera, not any one camera's. Neither carries a
maker's name or mark.

- `model.js` (`rangefinder`): the rangefinder at work. Seen from behind, as the photographer holds
  the camera, the shell drawn see-through. One parameter, the distance the lens is focused at.
- `exploded.js` (`rangefinder-exploded`): the camera taken apart, from the same side, in 30
  parts (the lens's glass in its four groups and the aperture blades among them), each also
  drawn on its own for the page's part cards.
- `optics.js`: the lens's glass, shared by the camera taken apart and the section below.
- `lens-section.cjs`: a section through the lens to the film (`assets/img/teardown/lens.json`);
  the page traces the light through it (`assets/js/camera-lens.js`).
- `lens-psf.cjs`: the spot that one point of the subject makes on the film, the lens's point
  spread function, for each of the lens's eleven distance settings and seven apertures
  (`assets/img/teardown/lens-psf.json`); the page paints it beside the section as the focus and
  aperture sliders move.
- `shutter.js` (`shutter-film`): the shutter caught mid-travel and the film behind it, seen from
  the lens's side.

Orientation, as the owner asked: from the photographer's side the viewfinder's big window (and
the eyepiece behind it) is at the left end of the top cover, the rangefinder's small window at
the right, as on a Leica M (the rewind knob above the viewfinder at the left; the shutter-speed
dial, the release and the advance lever at the right).

Intended use: inline on the page, about 350–900 px wide on a dark ground, styled by the page
(assets/css/camera.css). Labels are set at 4.6 mm rather than the print size of 3.2 mm, for
reading on a screen, and dropped on screens narrower than 600 px.

| Feature group | Evidence | How it is used |
| --- | --- | --- |
| Overall arrangement: a long body with rounded ends, the top cover with the viewfinder window, the frame-line window and the rangefinder window on its front, the eyepiece behind the viewfinder window, the rewind knob, speed dial, release, advance lever and accessory shoe on top, strap lugs at the ends, the lens mount | Features visible in photographs of 35 mm rangefinder cameras | Reconstructed proportions, estimated (body 138 × 34 × 80 mm) |
| Base length between the two windows (70 mm) | Estimated, typical of 35 mm rangefinders | Concept value |
| Viewfinder front lens, eyepiece, window glass, frame-line prism | Hidden construction | Illustrative: one element each, simplified |
| Half-silvered mirror at 45° in the viewfinder path | Hidden construction; the principle of a coincident-image rangefinder | Illustrative |
| Rangefinder mirror on a vertical pivot, its lever and pin, the roller lever (a rocker on a post, slotted for the pin), the roller | Hidden construction | Illustrative linkage, chosen so the motion is right: as the lens is focused closer its optics and cam move forward, the roller follows the cam (a spring is implied), the rocker tips and the pin turns the mirror the way the optics need. Some cameras move a small lens in this path instead of the mirror |
| Lens: bayonet, helicoid, focus ring with tab and distance scale, aperture ring, optical unit, focusing cam at the back | Features of interchangeable rangefinder lenses | Illustrative; the cam's travel is derived from the linkage, so lens, cam, roller, levers and mirror agree at every setting |
| Shutter (two curtains on drums), base plate with locking key, film cassette, take-up spool | Features of bottom-loading 35 mm rangefinder cameras | Illustrative, simplified |
| Light from the subject, and the rangefinder's line of sight | Concepts with no physical form | Lines; the mirror is the exact bisector of the line of sight and the path across to the half-silvered mirror, so the line of sight crosses the viewfinder's where the lens is focused |
| Angles and travel | Real parallax angles are a few degrees at most (about 5.6° at 0.7 m, 3.9° at 1 m), invisible on paper | The parallax angle, and the mirror's swing with it, drawn nine times their size; the lens's travel comes out at 6.7 mm at 0.7 m, nearly twice a 50 mm lens's 3.9 mm. The page says "not to scale" |
| The subject 1 m away | Concept | A post, at the distance (nine-times angles) where the two lines of sight meet when the lens is focused at 1 m |
| The lens's glass: six elements in four groups (a front element, a cemented pair, the aperture blades, a cemented pair, a rear element) | The classic double-Gauss form, the textbook design scaled to a 50 mm focal length; the layout of many 50 mm lenses | Illustrative: not any one lens's prescription and named for none. Ray-traced: about 49.8 mm focal length, the film 28.7 mm behind the last glass (27.8 mm behind the bayonet's face), every element's edge of positive thickness; at f/2 the light from infinity meets within 0.03 mm |
| The light's path through the camera taken apart | Concept with no physical form | The lens's axis, drawn as an axis trail from in front of the front element (moving with it as the lens comes apart) to the film inside the body; the parts it passes behind hide it, the glass does not |
| The light through the lens | Concept, computed | Traced surface by surface with Snell's law in the plane of the section, from a point 1 m from the film; the aperture's opening for each f-number from the f/2 marginal ray; the optical unit's travel for each distance found by tracing. Glass outside an element's clear aperture stops the light |
| The spot on the film (the lens's point spread function) | Concept, computed | Wave optics for green light (550 nm): every ray from a point 1 m from the film traced with the page's own tracer (`camera-lens.js`, run in Node), its optical path to a sphere centred on the film's axis point giving the wavefront, and the Debye integral of the round pupil (a Hankel transform, J0 from Abramowitz and Stegun 9.4.1 and 9.4.3) giving the light on the film. 7,200 rays across the pupil (the phase between neighbours at most 0.27 rad); the light on the film adds up to 99.7–100% of the light through the pupil in all 77 states. The lens focused as the drawing and the rangefinder's cam focus it, where the rays near the axis meet; this textbook design then leaves, wide open, a halo from the outer zones of the glass, whose light meets up to 0.2 mm in front of the film (spherical aberration). 80% of the light within 75 µm at f/2, 51 at f/2.8, 20 at f/4, 10 at f/5.6, 8.6 at f/8, 12 at f/11, 17 at f/16; focused at ∞, 1.11 mm at f/2 and 0.14 mm at f/16. Each view scaled to its own brightest and gamma-encoded (0.45) for the screen; the 1.6 mm view averages the light over rings 4 µm wide, as a pixel would collect it |
| The section's barrel, rings, bayonet, film and pressure plate | Hidden construction | Illustrative proportions, drawn to the skill's section conventions: cut solids hatched (the moving optical unit one way, the fixed parts the other), glass left clear with a pale tint, one centreline |
| The shutter mid-travel and the film path | Features of two-curtain focal-plane shutters and bottom-loading 35 mm cameras | Illustrative: a 36 × 24 frame, 35 mm film with its perforations, the slit between the curtains at one moment of their travel |

## Rebuild and proof

From `_teardown/rangefinder/`:

```sh
node build-frames.cjs      # writes ../../assets/img/teardown/rangefinder-action.json, -apart.json, -parts.json and shutter.json
node lens-section.cjs      # writes ../../assets/img/teardown/lens.json
node lens-psf.cjs          # writes ../../assets/img/teardown/lens-psf.json (about 10 s; after lens.json)
PATH="$PWD/../.bin:$PATH" node ../tools/scripts/proof.cjs drawing.json proof/ --quick
```

`build-frames.cjs` renders the drawing in action at the eleven distances of a lens's scale (∞, 10,
5, 3, 2, 1.5, 1.2, 1, 0.9, 0.8, 0.7 m) and the camera taken apart in nine eased steps, each set
cropped alike so the page can swap frames that line up; part drawings repeated between frames are
stored once, numbers rounded to 0.1 mm. It also draws each of the 25 parts on its own (fitted and
cropped to its own ink), and tags each label of the camera taken apart with its part's id. In action, the labels are laid out once (at 1 m) and only
their leaders follow the moving parts; taken apart, the parts are named only when fully apart. It
prints, for each distance, the mirror's swing, the lens's travel and the linkage's checks (the pin
inside the rocker's slot, the roller on the cam's face).

`lens-psf.cjs` prints, for each distance and aperture, the diameter holding 80% of the light, how
much of the light the calculation holds and the largest phase step between neighbouring rays, and
stops if the light does not add up or the rays are too sparse.

The proof script looks for `chromium` on the PATH; `../.bin/chromium` (not kept in the repository)
was a two-line wrapper running the build machine's headless Chrome with `--no-sandbox`.

Checked: the quick proofs of both drawings; renders of the frames at ∞, 1 m and 0.7 m and of the
camera together, half apart and apart; the linkage figures (slot 6.9–8.0 mm of 5.6–9.6, the roller
on the cam at 15.5–16.4 mm from the lens's axis, within the cam's 12–19.5 mm). On the page, at
430 × 932, 390 × 844 and 1280 × 800, the page (sliders, drag, picking a part by tap, list and
keys, every part's own drawing, the finder, the lens's focus and aperture together with the spot
on the film, in focus and not, f/2 to f/16) was checked in a browser.
