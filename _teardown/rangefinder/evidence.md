# Evidence: how a rangefinder focuses

The drawing explains the coincident-image rangefinder of a Leica M-style camera for the
"How to focus" guide of the focus challenge (the photography wall's close-up). It is an
illustrative concept: no reference drawing, CAD model or teardown of a specific camera was
supplied, so the internals follow the classic layout of a coincident-image rangefinder, not
any one camera's construction. It carries no maker's name or mark.

The top cover is left off the drawing so the light can be followed; its two windows' glass stays
where the cover holds it. Labels are set at 4.6 mm rather than the print size of 3.2 mm, for
reading on a screen.

Intended use: an inline figure in the guide, about 600–1000 px wide on a dark page, one SVG
per focus setting (∞, 3 m, 1.5 m, 1 m, 0.7 m) swapped by a slider. Only SVG is produced (the
deliverable was narrowed to the tutorial; no standalone viewer, PNG or PDF downloads).

| Feature group | Evidence | How it is used |
| --- | --- | --- |
| Overall arrangement: a long body, the lens on the front, the top plate with a large viewfinder window and a small rangefinder window at its two ends, the eyepiece behind the viewfinder window | Features visible in photographs of 35 mm rangefinder cameras | Reconstructed proportions, estimated (body 138 × 34 × 80 mm) |
| Base length between the two windows (70 mm) | Estimated, typical of 35 mm rangefinders | Concept value |
| Viewfinder front lens, eyepiece, window glass | Hidden construction | Illustrative: one element each, simplified |
| Half-silvered mirror (beam splitter) at 45° in the viewfinder path | Hidden construction; the principle of a coincident-image rangefinder | Illustrative |
| Rangefinder mirror on a vertical pivot, its lever, the roller | Hidden construction | Illustrative: the classic swinging-mirror layout; some cameras move a small lens in this path instead of the mirror |
| Focusing cam at the rear of the lens, moving with the focus | Hidden construction; the principle of a coupled rangefinder | Illustrative; its travel is derived from the lever arm and the mirror angle so the linkage stays coherent at every setting |
| Light paths from the subject through both windows to the eye | Concept with no physical form | Drawn as lines; the mirror is the exact bisector of the incoming and outgoing rays |
| Angles and travel | Real angles are a few degrees at most (about 5.6° at 0.7 m, 1.3° at 3 m), invisible on paper | Exaggerated five times (the parallax angle), the mirror swing (half of it) and the cam travel with it; the figure says "not to scale" |

## Rebuild and proof

From `_teardown/rangefinder/`:

```sh
node build-frames.cjs                     # writes ../../assets/img/teardown/rangefinder-*.svg
PATH="$PWD/../.bin:$PATH" node ../tools/scripts/proof.cjs drawing.json proof/ --quick
PATH="$PWD/../.bin:$PATH" node ../tools/scripts/proof.cjs drawing.json proof/ --view=exploded --set=dioptres=1.4286
```

The proof script looks for `chromium` on the PATH; `../.bin/chromium` (not kept in the repository)
was a two-line wrapper running the build machine's headless Chrome with `--no-sandbox`.

Checked: the quick and full proofs (assembled, exploded and spread, at both ends of the focus
range): zero spacing rebuilds the camera, every part shows at least half of its own linework (the
cam, the most hidden, 53%), and a 400% crop of the linkage at 0.7 m shows clean lines with the
light passing through the glass. On the page, at 1280 × 800 and 390 × 844, the drawing, its
slider and the guide's card were checked in a browser.
