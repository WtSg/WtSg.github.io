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

---

<!-- WORLD: darkroom. Everything below applies to /photography/ only (_layouts/gallery.html, assets/css/darkroom.css, assets/js/darkroom.js). The frontmatter and every section above belong to the homepage world and do not apply to the gallery; the rules below do not apply to the homepage. -->

## Darkroom World (/photography/)

A separate visual world for the photography gallery. It shares nothing with the homepage figure: no STIX, no DejaVu, no spines, no tab blue. The homepage's flat, no-shadow, no-gradient rules stop at this boundary; the darkroom is built from physical materials that cast soft shadows and catch light.

### Overview

**Creative North Star: "The Darkroom"**

The gallery is a working darkroom lit by one safelight. Each photograph is a sheet of paper in a developer tray; it develops as the visitor reaches it (blank paper, then shadows, then full tones, while the developer ripples), then flies up to a sagging drying line and swings on a wooden clothespin. A lit IN USE sign is the light switch: the room flickers to white fluorescent light and every print is laid out on wires across a grey wall, with the empty tubs on the bench below. Any print can be lifted out to look at closely.

Two voices carry the type: Barlow Condensed for darkroom signage, timers and labels; Permanent Marker for grease pencil on masking tape. Text is sparse; the photographs lead. Photographs always keep their true colours and their own aspect ratios once developed.

**Key Characteristics:**
- Near-black red room with a single safelight pool; a neutral grey room with the lights on.
- Bright photo-paper prints with white borders, sized from the image's own aspect ratio.
- Physical materials: tray rim and liquid, masking tape, wire and clothespins, a sign plate, bench tubs.
- Condensed uppercase signage plus grease-pencil handwriting.
- One motion story per print: develop, fly, hang, swing. Every state appears instantly under reduced motion.

### Colors

Two modes of the same room, swapped by one attribute on `body` (`data-lights="safe"` or `"on"`). Tokens live as custom properties in `assets/css/darkroom.css`; these values are normative for the gallery.

```yaml
darkroom:
  safelight:            # :root (default)
    room: "#170605"
    room-0: "rgba(23, 6, 5, 0)"
    room-2: "#230a07"
    rim: "#110403"
    rim-hi: "#4a1810"
    liquid: "#3a0d08"
    pool: "rgba(190, 34, 20, .42)"
    pool-2: "rgba(176, 30, 18, .10)"
    text: "#f2d7d0"
    muted: "#bf938a"
    wire: "#7a4236"
    paper: "#f4f3ef"
    tape: "#d9c9a5"
    tape-ink: "#1f1b16"
    tape-ink-2: "#4a4034"
    focus: "#ffb4a6"
    selection: "#c4281a on #fff4ef"
  lights-on:            # body[data-lights="on"]; paper and tape tokens carry over unchanged
    room: "#a3a4a0"
    room-0: "rgba(163, 164, 160, 0)"
    room-2: "#979894"
    rim: "#5f605c"
    rim-hi: "#7d7e7a"
    liquid: "#b9c1bd"
    pool: "rgba(255, 255, 255, .26)"
    pool-2: "rgba(255, 255, 255, .07)"
    text: "#121212"
    muted: "#2b2b29"
    wire: "#3a3b38"
    focus: "#0b3a6b"
    selection: "#0b3a6b on #fff"
  fixed:                # material colours that do not change with the light
    sign-red: "linear-gradient(#cf3a27, #a6200f), text #fff4ef, border #2b0b07"
    sign-off: "linear-gradient(#cdcdc8, #bdbdb8), text #4d4d48, border #9a9a95"
    clothespin-wood: "#7d5832 / #c99d66 / #a77a48"
    clothespin-spring: "#5b5f63"
    bench-tub: "rim #4a4b47 (lip #8e8f8b, base #3c3d3a), inner wall #686965, chemistry #8f9894"
    loupe-ground: "#dedfdb, text #161616, labels #5a5a55, focus #1f5f9a"
    loupe-backdrop: "rgba(12, 3, 2, .78)"
    flicker-light: "#f3f5f1"
    theme-color: "#170605 safelight, #a3a4a0 lights on"
```

- **Safelight Room** (room, room-2): the page ground and the sticky bar's fade. Never pure black; it is a warm near-black red.
- **Safelight Pool** (pool, pool-2): the one light in the room, a radial pool centred at 50% 44% over the bench, fixed behind everything.
- **Tray Black and Lit Lip** (rim, rim-hi): the developer tray's plastic rim; the top edge catches the light.
- **Developer** (liquid): the pool of chemistry around the print.
- **Safelight Text and Muted** (text, muted): the wordmark, sign hint, timer, footer. Muted carries the subtitle and secondary labels.
- **Photo Paper** (paper): print borders, pins, the flyer, the skip link. It stays white under both lights.
- **Masking Tape** (tape, tape-ink, tape-ink-2): caption labels; grease pencil in tape-ink, the camera line in tape-ink-2.
- **Wire** (wire): the drying line and the lights-on hanging wires.

**The Two Lights Rule.** The room has exactly two states, safelight and lights on, and every surface colour is a token that both states redefine. A new surface takes its colour from these tokens, never from a third palette.

**The Untouched Print Rule.** Nothing tints a developed photograph: the safelight colours the room, the rim and the liquid, never the image. Paper and tape keep their own colours in both lights.

**The Legible Room Rule.** Every text pair holds at least 4.5:1 in both lights. Measured in the build: muted on room 7.3:1 (4.98:1 at the pool's centre), tape-ink-2 on tape 6.2:1, lights-on muted on room 5.7:1, sign text on the red plate 4.5:1 at its lightest stop, lights-on sign text 4.5:1, loupe labels 5.2:1.

### Typography

**Label Font:** Barlow Condensed 500 and 700, self-hosted woff2 (with Arial Narrow, Roboto Condensed, sans-serif)
**Hand Font:** Permanent Marker 400, self-hosted woff2 (with Marker Felt, cursive)

**Character:** Industrial darkroom signage against grease pencil on tape. Licences ship beside the fonts in `assets/fonts/`.

- **Wordmark** (Barlow 700, 1.2rem/1.15, 0.1em, uppercase): "Name · Photography"; the name in text, the rest in muted. 1rem and 0.08em at 700px and below.
- **Sign** (Barlow 700, 1.05rem/1, 0.24em, uppercase): IN USE on the plate. 0.8rem and 0.18em on small screens.
- **Hand** (Permanent Marker 400, 1.05rem/1.3): the tape caption ("No. n" plus an optional title). The subtitle uses 1rem/1.2, rotated -1.5deg.
- **Tape Line** (Barlow 500, 0.8rem/1.3, 0.07em, uppercase): place and year, and the camera line, on tape.
- **Small Label** (Barlow 500, 0.78 to 0.82rem/1, 0.14 to 0.16em, uppercase): the switch hint, the tray timer (tabular, value in 700 text), Add photos.
- **Spec** (Barlow 500, 0.95rem/1.3; terms 0.78rem, 0.12em, uppercase): camera details in the loupe.
- **Button** (Barlow 700, 0.85rem/1, 0.12em, uppercase): loupe controls.
- **Body** (Barlow 500, 1.05rem/1.45; footer 0.95rem/1.5, 0.02em): the page base and the footer.

**The Grease Pencil Rule.** Permanent Marker is only for what a hand would write on tape: the print number, its title, the subtitle. Everything printed, signed or measured is Barlow Condensed.

### Layout

Full-bleed room with a fluid gutter (clamp(1rem, 4vw, 2.5rem)). A 4.4rem header holds the wordmark at top left. Below it, a sticky bar (6.2rem; 5.2rem at 700px and below) carries the drying line and, at its right end, the IN USE sign; it fades to transparent from 62% down so trays slide under it. Trays are one per viewport, centred, with `scroll-margin-top` equal to the bar.

**Print sizing budget.** A print's image height is the smallest of 62svh, the space left after the bar, rim, basin and paper padding and 5.6rem for tape and timer (the first tray also subtracts the header), and the viewport width minus all horizontal chrome divided by the aspect ratio. Width is always height times the photograph's own ratio (`--ar`, w / h from the data). The contract's "about 68%" landed as a 62svh cap; the build wins.

**Drying line.** The wire is a quadratic curve (sag of 26px at the centre); each pin's vertical offset follows it as 52 f(1 - f) px. Pins shrink together so every print fits (minimum 16px tall); past that the line scrolls horizontally. Pin height is 3.3rem (2.5rem on small screens).

**Lights-on wire rows.** The trays become justified rows: each print takes flex-grow equal to its aspect ratio with a basis of ratio × 15rem (6.4rem on small screens), column gap clamp(1rem, 2.2vw, 1.8rem), row gap clamp(1.4rem, 3vw, 2.4rem). A 1.5px wire runs above each row, extended half a gap each side so neighbours join, and a filler element extends the last row's wire to the edge. Two clothespins bite each print at 16% and 84%. Prints tilt +0.45deg and -0.35deg in a three-step cycle. Tape and timers hide. The bench with three tubs (Developer, Stop, Fixer) sits below; the sign stays fixed top right.

Breakpoint: 700px. The loupe goes from a stage plus a 13 to 17rem info column to a single stacked column.

### Elevation & Depth

Physical. Depth comes from soft, blurred drop shadows under objects that sit on or above something, inset shadows for the tray's and tubs' interior, and short linear gradients for material sheen (tape, sign plate, tray liquid, clothespin wood). There are no hard offset shadows.

- **Print in tray** (`0 .15rem .3rem rgba(0,0,0,.35), 0 1rem 2rem -1rem rgba(0,0,0,.6)`); hover lifts it -0.3rem with a deeper shadow.
- **Tray** (`inset 0 0 0 1px rgba(255,140,120,.18), inset 0 .8rem 1.6rem rgba(0,0,0,.5), 0 1.8rem 3rem -1.4rem rgba(0,0,0,.85)`).
- **Pinned print** (`0 .35rem .6rem -.25rem rgba(0,0,0,.7)`); clothespin `0 2px 3px rgba(0,0,0,.45)`.
- **Tape** (`0 1px 2px rgba(0,0,0,.4)`).
- **Hung print, lights on** (`0 1px 2px rgba(0,0,0,.25), 0 .9rem 1.4rem -.7rem rgba(0,0,0,.45)`).
- **Loupe print** (`0 .2rem .4rem rgba(0,0,0,.18), 0 1.6rem 3rem -1rem rgba(0,0,0,.45)`).

**The One Light Rule.** The only radial gradient in the room is the safelight pool on the room itself. Trays, prints, tape, sign and tubs never carry a radial glow; their light comes from linear sheens and the rim's lit edge.

### Shapes

Real objects have real corners: tray 1rem, bench tubs 0.9rem, sign plate 0.3rem, buttons 0.25rem, clothespins 2px. Prints and tape are square-cut paper with straight edges; tape is set at -1.6deg and overlaps the rim by 1.15rem. Photographs are rectangles at their own aspect ratio inside a paper border (clamp(.5rem, 1.3vw, .85rem) in trays, 3px on pins, 0.4rem on the wall).

### Components

#### Developer tray
A black plastic basin (rim 0.55rem, lit top edge) filled with developer: a 118deg sheen, a red fall-off from the top, over the liquid token. Holds one print and a "Dev 0:00" timer above the rim at right that counts to 1:30 while the print develops.

#### Paper print
The photograph inside a paper border, sized by the budget above. The whole print is a button that opens the loupe (cursor zoom-in). The image's alt is the title, or "Photograph No. n", plus the place.

#### Masking tape
A strip under the tray rim: grease-pencil "No. n · title", then place and year, then the camera line (camera, focal length, aperture, shutter, ISO joined by " · "). Empty fields are skipped.

#### Drying line and clothespins
An SVG wire with non-scaling 1.5px stroke; each pin has a 7×21px wooden clothespin with a steel spring band and a paper-bordered thumbnail hanging below it. Pins are hidden until their print has developed; then they are focusable and either scroll to their tray (safelight) or open the loupe (lights on).

#### IN USE sign and switch
One button: a lit red plate reading IN USE, and under it a small wall switch drawn in CSS (a rounded 0.62×1rem outline with a knob that sits down with the lights off and up with them on) beside the hint "Lights on" or "Safelight". With the lights on the plate goes dark grey. On small screens the hint text is hidden visually and stays the button's accessible name.

#### Bench tubs
Three deep 4:3 tubs (clamp(5.5rem, 15vw, 11rem)), aria-hidden, shown only with the lights on: a thick rim with a lit lip, an inset inner wall, a flat pool of chemistry, and a bold Barlow 700 label centred in the tub (0.78rem, 0.16em, uppercase; 0.62rem and 0.06em at 700px and below).

#### Loupe
A full-screen modal dialog on light grey (#dedfdb) over a dark red backdrop: the print on a paper border sized to fit the viewport at its own ratio, the tape copied beside it, a spec list, and Previous, a "n / N" count, Next and a solid "Back to the darkroom" button. Arrow keys and horizontal swipes (over 50px) step; Escape and clicks on the backdrop close; focus returns to the opener, or to the tray the visitor browsed to.

#### Buttons
Outline: 1.5px currentColor border, 0.25rem corners, 2.75rem minimum height, transparent, hover rgba(0,0,0,.06). Solid: #161616 fill, #f4f3ef text, hover #333.

### Motion

- **Develop** (2.8s, cubic-bezier(.5,0,.2,1)): starts when 45% of the print is visible and the image has loaded, after a 450ms beat of blank paper. Filter keyframes keep the order contrast, brightness, saturate so the latent print is pure white paper: `contrast(.18) brightness(3.2) saturate(0)` → `.62 / 1.75 / 0` at 30% → `.98 / 1.16 / .45` at 62% → `1 / 1 / 1`. The print settles from scale .975 and +0.25rem; a linear sheen sweeps the developer.
- **Ripple** (fine pointers only): an SVG filter of fractal-noise turbulence (base frequency 0.006 0.018, breathing to 0.009 0.024 on a 2.8s loop) driving a displacement map whose scale falls 22, 12, 5, 0. The image layer is overscanned in step (scale 1.065, 1.036, 1.016, none) inside an overflow-hidden frame, so the displaced edge never shows and the photograph stays square against the paper. Coarse pointers get a gentle skewY slosh of the whole print instead.
- **Fly to the line** (1150ms, cubic-bezier(.45,0,.2,1)): a paper copy peels up 14px, arcs toward its pin at a mid scale with -9deg, overshoots 6px at 7deg, then lands. Skipped if the print is off screen.
- **Swing** (1.9s, cubic-bezier(.3,.6,.3,1)): pivoting just above the print, 16, -10, 6, -3, 1.2, 0deg; the clothespin snaps (scaleY 1.25, 350ms). Hover gives a 1.1s nudge.
- **Lights on**: a #f3f5f1 overlay flickers for 560ms (linear opacity steps ending at .82), then a view transition moves every print from tray to wall: groups 0.8s cubic-bezier(.22,.8,.24,1), root cross-fade 0.55s, each print delayed 45ms after the previous (capped at 540ms). Turning the lights off skips the flicker.
- **Loupe lift** (820ms, cubic-bezier(.2,.75,.25,1)): from the print's own position the image rises -1.4rem, scale 1.035, rotateX 7deg under 1400px perspective with a deepening shadow, then sets down; the dialog ground fades in over 0.45s and info and controls rise after 0.3s. Close fades in 200ms; stepping slides 4% with 1.2deg of tilt (170ms out, 340ms in).

### Reduced motion

Under `prefers-reduced-motion: reduce`, every print loads developed and every pin is already hung; nothing develops, ripples, flies or swings. The light switch changes the room at once with no flicker and no view transition. The loupe opens, steps and closes without animation; hover nudges, print and sign transitions and smooth scrolling are off. Switching the preference on mid-visit settles everything immediately. If the script fails to load within 4s, the latent state is removed and all prints show.

### Do's and Don'ts

#### Do:
- **Do** size every print from its own width-to-height ratio, in the tray, on the line, on the wall and in the loupe.
- **Do** keep the photograph's colours untouched once developed; the safelight colours the room, not the image.
- **Do** caption a print with "No. n" and only the title, place, year and camera details that exist.
- **Do** take every colour from the safelight and lights-on tokens, and hold every text pair at 4.5:1 or more in both lights.
- **Do** keep the ripple overscanned inside a clipped frame so the photo edge stays square.
- **Do** give every new motion an instant, settled state under reduced motion.

#### Don't:
- **Don't** put a tint, overlay or colour filter over a developed photograph.
- **Don't** crop or force a photograph into a fixed aspect ratio.
- **Don't** show file names anywhere: not in captions, alt text or labels.
- **Don't** cut torn or deckled edges with clip-path; paper and tape are straight-cut.
- **Don't** draw stripes or textures with repeating gradients.
- **Don't** put a radial glow on a surface; the safelight pool on the room is the only radial light.
- **Don't** use hard offset shadows; shadows are soft and fall from real objects.
- **Don't** bring homepage devices (spines, ticks, STIX, DejaVu, tab blue) into the darkroom.
