---
name: Wentao Shangguan
description: A personal research page drawn as a matplotlib figure, with the name and portrait resolving out of Gaussian noise.
colors:
  ground: "#ffffff"
  ink: "#121212"
  ink-2: "#404040"
  ink-3: "#616161"
  spine: "#121212"
  hairline: "#e3e3e3"
  link: "#1f77b4"
  link-hover: "#12507d"
  marker: "#ff7f0e"
  select: "#cfe2f1"
  mark-target: "#e9f2f9"
  ink-raised: "#2f2f2f"
  ground-hover: "#f2f2f2"
typography:
  display:
    fontFamily: "STIX Two Text, STIX Two, Times New Roman, Times, serif"
    fontSize: "min(12cqw, 6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "STIX Two Text, STIX Two, Times New Roman, Times, serif"
    fontSize: "clamp(1.875rem, 1.4rem + 1.4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "STIX Two Text, STIX Two, Times New Roman, Times, serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.28
    letterSpacing: "-0.005em"
  title:
    fontFamily: "STIX Two Text, STIX Two, Times New Roman, Times, serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "STIX Two Text, STIX Two, Times New Roman, Times, serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"onum\" 1, \"pnum\" 1"
  caption:
    fontFamily: "DejaVu Sans, Bitstream Vera Sans, Verdana, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  label:
    fontFamily: "DejaVu Sans, Bitstream Vera Sans, Verdana, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  tick:
    fontFamily: "DejaVu Sans, Bitstream Vera Sans, Verdana, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
rounded:
  none: "0px"
spacing:
  space-1: "0.5rem"
  space-2: "1rem"
  space-3: "1.5rem"
  space-4: "2.5rem"
  space-5: "4rem"
  section: "clamp(4.5rem, 3rem + 6vw, 8.5rem)"
  gutter: "clamp(1rem, 0.5rem + 2.5vw, 2.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.ground}"
  button-line:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "2.75rem"
  button-line-hover:
    backgroundColor: "{colors.ground-hover}"
    textColor: "{colors.ink}"
  button-small:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2rem"
  nav-link:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    padding: "0.5rem 0"
  nav-link-hover:
    textColor: "{colors.ink}"
  link:
    textColor: "{colors.link}"
  link-hover:
    textColor: "{colors.link-hover}"
  slider-thumb:
    backgroundColor: "{colors.marker}"
    rounded: "{rounded.none}"
    width: "0.75rem"
    height: "1.125rem"
  axes-plot:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.none}"
  video-control:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 0.625rem"
    height: "2rem"
---

# Design System: Wentao Shangguan

## Overview

**Creative North Star: "The Paper's Figure"**

The page is laid out the way a machine-learning paper presents results: a white figure ground, imshow panels framed by thin black spines with outward ticks, numbered figure captions, and bracketed [n] citations that jump to a reference list. Every visual device is borrowed from matplotlib and the publication page, never from web-template furniture. The only material is grayscale Gaussian noise, i.i.d. standard-normal samples painted one per pixel on a canvas and scaled up with crisp, pixelated edges.

Two voices carry the type: STIX Two Text, a scientific serif, for the name, headings and reading text; DejaVu Sans, matplotlib's default label face, for everything a plot would label (ticks, captions, dates, navigation, buttons, reference numbers). Color is almost absent. The matplotlib default cycle supplies the only two hues: tab:blue for links and focus, tab:orange for the one live marker. Density is generous and editorial: long section gaps, a 68ch measure, and no containers around content.

Motion is one authored moment. On load the hero samples from t = 1 to t = 0, the name and portrait resolving out of noise, and the t slider lets the visitor re-noise both panels. Nothing else on the page animates in.

**Key Characteristics:**
- White ground, near-black ink, three gray steps for text hierarchy.
- 1px black spines with 5px outward ticks frame every image and the time axis of dated entries.
- Pixelated N(0,1) grayscale noise as the single material.
- tab:blue links; tab:orange on the slider handle only.
- Square corners everywhere; no shadows, gradients or cards.
- Serif for reading, DejaVu Sans for anything a plot would label.

## Colors

A monochrome figure ground with two matplotlib cycle hues, each held to one job.

### Primary
- **Matplotlib Tab Blue** (link): every inline link, profile link and citation, with a 1px underline at 45% of the link color; also the 2px focus outline. Hover deepens to **Deep Tab Blue** (link-hover) with a full-strength underline.

### Secondary
- **Matplotlib Tab Orange** (marker): the t-slider handle and nothing else. It marks the live parameter, never text.

### Neutral
- **Figure White** (ground): page, header, plot backgrounds, inverted button text.
- **Plot Ink** (ink): headings, body, the name, primary buttons. The same value is used as **spine** for axes borders, tick marks, time-axis rules and the slider track.
- **Label Gray** (ink-2): captions, tick labels, nav links, entry dates, author lists, venues.
- **Muted Gray** (ink-3): update dates, reference numbers, subplot letters and meta, colophon.
- **Hairline** (hairline): the header's bottom rule, the colophon rule, and the resting underline on title links that sit in ink.
- **Selection Blue** (select) and **Target Blue** (mark-target): pale tab-blue tints for text selection and for the reference or entry a citation jumps to.
- **Raised Ink** (ink-raised) and **Hover Paper** (ground-hover): hover fills for solid and outline buttons and the video control.

### Named Rules
**The One Orange Rule.** Tab orange appears on exactly one element: the handle of the live t slider. Bullets, highlights and badges stay in ink or tab blue.

**The Matplotlib Cycle Rule.** New hues come from the matplotlib default cycle in its order, and only for a plotted or interactive mark. Nothing is decorated with color.

## Typography

**Display Font:** STIX Two Text (with STIX Two, Times New Roman, Times, serif)
**Body Font:** STIX Two Text
**Label Font:** DejaVu Sans (with Bitstream Vera Sans, Verdana, sans-serif)

**Character:** The pairing a LaTeX paper with matplotlib figures produces: a sober scientific serif for prose and math, and the plotting library's humanist sans for every label. Both are self-hosted woff2 subsets; STIX carries a Greek italic subset so ε and similar symbols set in the serif.

### Hierarchy
- **Display** (700, min(12cqw, 6rem), 0.92): the name only, set inside the wide hero axes at lower left and sized to the panel through container units.
- **Headline** (700, fluid 1.875 to 2.5rem, 1.1): section headings.
- **Lede** (400, 1.75rem, 1.28, 34ch): the one research statement under the hero.
- **Title** (700, 1.375rem, 1.3): entry headings and the Updates heading. Reference and subplot titles use body size in 700.
- **Body** (400, 1.1875rem, 1.55, old-style proportional figures): all reading text, held to a 68ch measure (threads 44ch).
- **Caption** (DejaVu 400, 0.9375rem, 1.45 to 1.5): figure captions, profile links, the slider row. A leading "Figure n." is set in 700 ink.
- **Label** (DejaVu 400, 0.875rem, 1): nav, buttons, entry dates, reference numbers, colophon. Tabular lining figures.
- **Tick** (DejaVu 400, 0.6875rem, 1): axis tick values in ink-2.

The contact email is set large in the serif (400, fluid 1.75 to 3rem, 1.1) as the page's closing statement. Below 48rem, body steps to 1.125rem, title to 1.25rem and lede to 1.5rem.

### Named Rules
**The Plot Label Rule.** If matplotlib would draw it as a label (ticks, axis titles, captions, dates, numbers in brackets, controls), it is DejaVu Sans with tabular lining figures. Everything a reader reads as prose is STIX.

**The Math Italic Rule.** Variables in captions and axis titles (t, x, ε, N) are STIX italic at about 1.12 to 1.15em, even inside DejaVu text.

## Layout

A single column inside a 75rem wrap with a fluid gutter (1 to 2.5rem). A sticky 3.25rem header carries the name as a DejaVu bold wordmark, section links, and a small solid Email button. Sections are separated by a fluid section gap (4.5 to 8.5rem) with no rules between them.

Figure 1 is a two-column grid at 256:96 proportion (wide name panel, square portrait), 3.5rem apart, with a left inset of 1.75rem for y-tick labels; the caption sits under panel (a) and the slider under panel (b). The intro below is an 8:4 grid (statement and actions, Updates). Research threads are two columns. Dated entries are a two-column grid: an 11rem right-aligned date gutter, then the 68ch content. Publications are a 3rem number column and the reference. Earlier work is a 3-column grid of subplots; each slot is a 4:3 cell in which the axes shrinks to its image's aspect ratio, like imshow.

Spacing steps are 0.5, 1, 1.5, 2.5 and 4rem plus the section gap. Breakpoints: at 64rem the intro stacks and subplots go to 2 columns; at 48rem everything is one column, the nav wraps to a horizontally scrolling second header row, the figure panels stack (portrait capped at 15rem), and the date gutter moves above each entry with the time axis on the far left.

## Elevation & Depth

Flat. There are no shadows, gradients, blurs or overlapping layers. Structure comes from 1px spines and hairlines, and depth only from the noise itself: the noise canvas sits over the clean panel at opacity t, which is exactly the interpolant x_t = (1 − t)x₀ + tε.

### Named Rules
**The Figure Is Flat Rule.** A surface that needs separation gets a 1px spine or hairline, never a shadow or a tinted card.

## Shapes

Square corners throughout (0px): buttons, the slider thumb, plot frames, the video control, and the filled 0.75rem ink square that bullets the internship line. Images are framed by a 1px ink border and clipped to it. Ticks are 1px by 5px strokes drawn outward from the spine, with labels 9px beyond. Icons are 16px inline SVG drawn with 1.5px square-ended strokes to match the spines.

## Components

### Buttons
Solid and quiet, like a plot toolbar.
- **Shape:** square corners (0px), 1px ink border.
- **Primary:** ink fill, white DejaVu label at 0.9375rem, 2.75rem tall, 0 1.125rem padding. Used for the email action.
- **Hover / Active:** fill lifts to raised ink on hover and drops to pure black on press; 160ms ease-out color transition.
- **Line:** white fill, ink text and border; hover fills hover paper. Used for "Copy address", which swaps its copy icon for a check and reads "Copied" for 2.4s.
- **Small:** 2rem tall, 0 0.75rem padding, 0.875rem label. Used in the header.

### Navigation
Header links are DejaVu 0.875rem in label gray with no underline; hover turns them ink with a 1px underline offset 0.3em. The wordmark is DejaVu 700 in ink. On mobile the links drop to 0.8125rem on a scrolling row under the wordmark.

### Links and citations
Body links are tab blue with a 1px underline at 0.2em offset. Titles that link (references, subplots, research leads) rest in ink with a hairline underline and turn deep tab blue on hover. Citations are bracketed numbers at 0.75em in DejaVu, no underline until hover, linking to the reference, which is highlighted in target blue (600ms ease-out).

### Axes (signature)
Every image is an imshow panel: a 1px ink frame on a white plot area, tick marks and DejaVu tick values on the bottom and left spines in image-pixel units, and an optional centered axis title such as "(a) t = 0.00". Subplots carry a letter caption "(a)" in muted gray, a title, a DejaVu meta line, and a description. Groups of panels close with a "Figure n." caption.

### Noise field (signature)
A canvas sized to the panel's own pixel grid (for example 256×96) painted with seeded i.i.d. N(0,1) samples mapped to gray levels (127.5 + 52z, clamped), stretched with pixelated rendering. Over a live image its opacity is t. Shown alone at full opacity it is a placeholder for content not yet sampled.

### t slider (signature)
A range input labelled "Noise level" with a 1px ink track and a square tab-orange thumb (0.75 × 1.125rem) with an ink border, and a live tabular "t = 0.00" readout. Dragging it sets t on every noise layer and axis title in the figure. Hidden without JavaScript.

### Time axis
Dated entry lists draw a 1px ink spine down the date gutter, with a 5px outward tick at each entry's date. Dates are right-aligned DejaVu 0.875rem in label gray.

### Video control
A drawn play/pause control replaces browser chrome: line-button styling at 2rem tall with a 16px SVG glyph and a text label. Videos play only while on screen and never under reduced motion.

### Motion
One sampling run on load: a 250ms hold, then t falls from 1 to 0 over 1.8s on a cos² schedule, starting after fonts load. Reduced motion opens at t = 0 and disables smooth scrolling. Other transitions are 160ms ease-out color changes and the 600ms citation-target fade.

## Do's and Don'ts

### Do:
- **Do** frame every image or figure as axes: 1px ink spine, 5px outward ticks, DejaVu tick labels, and a "Figure n." caption.
- **Do** use the noise field, with real N(0,1) samples at the panel's own pixel grid, as the placeholder for missing imagery.
- **Do** cite claims with bracketed [n] numbers that link to the reference list.
- **Do** keep tab orange on the slider handle alone, and links in tab blue (#1f77b4).
- **Do** keep every corner square (0px) and every rule 1px.
- **Do** give any new motion a reduced-motion state that shows the settled result.

### Don't:
- **Don't** add cards, tinted panels, shadows, gradients or rounded tiles; separation is a spine or a hairline.
- **Don't** use tab orange for text, bullets or highlights.
- **Don't** set prose in DejaVu or labels in STIX; the split follows the Plot Label Rule.
- **Don't** add entrance animations beyond the hero sampling run.
- **Don't** use colored or smoothed noise; it is grayscale and pixelated.
