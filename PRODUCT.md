# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Industry research.** Research scientists and hiring managers at AI labs who are screening candidates for 2027 research internships in generative models, world models and foundation models. They skim for research fit, recent work and a way to reach the candidate.
- **Academic.** Faculty, collaborators and reviewers who want the research threads and the full publication record.

## Product Purpose

The personal website of Wentao Shangguan, a PhD candidate in Electrical and Computer Engineering at Boston University. It states the research theme, shows current work and publications, and gets the right visitors to start a conversation.

Success: a visitor knows who this is and what the research is about within about 30 seconds, and the next step is an email.

## Positioning

Research on statistics in generative models (diffusion guidance, posterior sampling, efficient LLM architectures), built on a background in computational imaging and physics-based inverse problems.

## Capabilities and Constraints

- A single-page static site built by GitHub Pages' own Jekyll: plain Jekyll, no plugins outside the GitHub Pages set. The custom domain (`CNAME`, www.wshangguan.com) stays.
- Content lives in `_data/` (`personal.yml`, `publications.yml`, `projects.yml`); the page template lives in `_layouts/`.
- Primary action: email (the owner's BU address, assembled in the browser and never written in the page source). Secondary: Google Scholar, GitHub, LinkedIn.
- Every research claim, number, venue, date and image on the site comes from the owner. Do not add, extend or reword results, venues or dates without the owner's approval.
- Work happens on a preview branch; nothing reaches `main` until the owner has reviewed it.

## Brand Commitments

- Name: Wentao Shangguan. The research theme is worded "statistics in generative models".
- Voice: plain, factual, first person. No hype or self-promotion.
- The page must not read as salesy, as a generic academic template, or as a generically AI-designed page.

## Evidence on Hand

- Profile photo: `img/profile-picture.jpg` (keep).
- Project media: `img/PBMS.png` (time-resolved particle beam microscopy), `img/cure.mov` (CURE), `img/cod.jpg`, `img/compressedSPC.jpg`, `img/emg.jpg`, `img/dcac.jpg` (earlier projects).
- No figures yet for the current projects (information sharing across Transformer layers, noise-aware guidance, UAL, SpecDepth). They will be chosen with the owner; never fabricate figures or result images.
- No CV link until an updated PDF is provided.

## Product Principles

1. Scannable in 30 seconds: name, affiliation, research theme, current work and how to get in touch, in that order.
2. Evidence over adjectives: papers, preprints and concrete results carry the case.
3. One page serves both audiences. Recruiters get fit and contact fast, academics get the full record, and neither has to dig.
4. Distinct but serious: a page with its own identity, not a theme and not a pitch.
