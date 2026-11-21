---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/brand/README.md
  - docs/brand/source/build.mjs
  - "cd docs/brand/source && npm install && node build.mjs"
supersedes: none
---

**What.** A logo kit in `docs/brand/`: a 16 by 16 pixel-art mark (an E of three lit memory slabs with a trace of pixels leaving each), Space Grotesk wordmarks, horizontal logos for dark and light backgrounds, a README banner, a social card and PNG exports. The README now opens with the banner.

**Why.** The lead asked for a dark pixel-art kit for READMEs and other surfaces, set in Space Grotesk.

**Result.** Every SVG has its type outlined to paths, so a README `<img>` renders it with no font. `docs/brand/source/build.mjs` regenerates every file from one pixel map and palette; its three tools are pinned there and listed in `docs/deps.md`.

**Consequence.** Upload `docs/brand/png/engram-social-1280.png` as the GitHub social preview if wanted.
