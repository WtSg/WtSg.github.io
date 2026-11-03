# Evidence: how a rangefinder focuses, and the camera taken apart

Two drawings for the "Inside the camera" step of the focus challenge's guide (the photography
wall's close-up), both of a Leica M-style camera, both illustrative concepts: no reference
drawing, CAD model or teardown of a specific camera was supplied, so the construction follows the
classic layout of a coincident-image rangefinder camera, not any one camera's. Neither carries a
maker's name or mark.

- `model.js` (`rangefinder`): the rangefinder at work. Seen from behind, as the photographer holds
  the camera, the shell drawn see-through. One parameter, the distance the lens is focused at.
- `exploded.js` (`rangefinder-exploded`): the camera taken apart, from the same side.

Orientation, as the owner asked: from the photographer's side the viewfinder's big window (and
the eyepiece behind it) is at the left end of the top cover, the rangefinder's small window at
the right, as on a Leica M (the rewind knob above the viewfinder at the left; the shutter-speed
dial, the release and the advance lever at the right).

Intended use: inline in the guide, about 350–900 px wide on a dark page, styled by the page
(assets/css/focus-game.css). Labels are set at 4.6 mm rather than the print size of 3.2 mm, for
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

## Rebuild and proof

From `_teardown/rangefinder/`:

```sh
node build-frames.cjs      # writes ../../assets/img/teardown/rangefinder-action.json and -apart.json
PATH="$PWD/../.bin:$PATH" node ../tools/scripts/proof.cjs drawing.json proof/ --quick
```

`build-frames.cjs` renders the drawing in action at the eleven distances of a lens's scale (∞, 10,
5, 3, 2, 1.5, 1.2, 1, 0.9, 0.8, 0.7 m) and the camera taken apart in nine eased steps, each set
cropped alike so the page can swap frames that line up; part drawings repeated between frames are
stored once, numbers rounded to 0.1 mm. In action, the labels are laid out once (at 1 m) and only
their leaders follow the moving parts; taken apart, the parts are named only when fully apart. It
prints, for each distance, the mirror's swing, the lens's travel and the linkage's checks (the pin
inside the rocker's slot, the roller on the cam's face).

The proof script looks for `chromium` on the PATH; `../.bin/chromium` (not kept in the repository)
was a two-line wrapper running the build machine's headless Chrome with `--no-sandbox`.

Checked: the quick proofs of both drawings; renders of the frames at ∞, 1 m and 0.7 m and of the
camera together, half apart and apart; the linkage figures (slot 6.9–8.0 mm of 5.6–9.6, the roller
on the cam at 15.5–16.4 mm from the lens's axis, within the cam's 12–19.5 mm). On the page, at
1280 × 800 and 390 × 844, the drawings, their tabs, slider, drag and finder, and the guide's card,
were checked in a browser.
