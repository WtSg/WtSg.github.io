---
version: 1
slug: "layouts-main-html"
primary_target: "_layouts/main.html"
related_targets: ["index.html"]
---

# Surface brief: home page

Scope: the single-page personal site (`index.html` via `_layouts/main.html`, content from `_data/*.yml`). Visitor mode: Persuade.

Audience and job: research recruiters and academics, weighted equally. Within about 30 seconds they learn who this is, the research theme and the 2027 internship search, then email. Academics go on to the research threads, publications and education.

Proof and content: owner-approved copy in `_data/`. Claims, numbers and venues come only from there. Current projects have no figures yet. The photography site has no URL yet, so its section is a placeholder container.

Constraints: plain Jekyll as GitHub Pages builds it; keep `CNAME`; no jQuery or Bootstrap; content is visible without JavaScript.

## Direction contract

THESIS: The page shows a diffusion sample. The name and portrait are drawn as x_t = (1 − t)·x₀ + t·ε and resolve from Gaussian noise into a clean figure, presented the way this field reads results: imshow panels with axes, captions and citations. It refuses the photo-left academic template and the dark, glowing AI landing page.

OWN-WORLD: White figure ground, near-black ink. The one material is grayscale Gaussian-noise cells (real N(0,1) samples, pixelated). Matplotlib tab:blue for links, tab:orange for the live t marker. 1px black axes spines with outward ticks. STIX Two Text for name, headings and body. DejaVu Sans, matplotlib's label face, for ticks, captions, dates, navigation and buttons. Bracketed [n] citations. No cards, shadows, gradients or rounded tiles.

STORY: The visitor understands the person (portrait, PhD candidate in ECE at BU), the theme (statistics in generative models) and the 2027 internship search. They believe the work because each claim cites a paper or preprint. The next step is an email.

FIRST VIEWPORT: A 52px sticky header (two rows on phones, with the section links): name on the left; Research, Work, Publications, Photography and Email on the right. Figure 1 spans the content width. Panel (a) is a wide imshow axes holding the name in 96px STIX bold, lower left, with ticks on two spines. Panel (b) is a square portrait axes. Live titles ("t = 1.00") update over both panels. The caption row carries the t slider on its right. Below the figure sit the intro (tagline, research line, internship line, primary "Email wentaos@bu.edu" plus copy, secondary links) and an Updates column. The primary action is visible at 1440×900.

FORM: Denoising trajectory, position 1 on the ordered list (the roll assigned position 4; the user chose this one). seed:1acd5f0f6f6a5462. Signature interaction: one sampling run from t = 1 to 0 on load (250 ms hold, then 1.8 s on a cos² curve), and the t slider re-noises both panels live. With reduced motion the page opens at t = 0. The photography placeholder holds noise at t = 1. There are no other entrance animations.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Figures for the four current projects, an updated portrait, and photography cover images (to be chosen with the owner).
- Photography site URL.
- An updated CV PDF (no CV link until then).
