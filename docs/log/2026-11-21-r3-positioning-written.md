---
date: 2026-11-21
author: claude-agent
type: change
card: R3
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/research/positioning.md
  - https://arxiv.org/abs/2611.20144
  - https://arxiv.org/abs/2610.22959
supersedes: none
---

**What.** `docs/research/positioning.md` was added: the novelty claim, what was read of HEAMS and SAFE-Mem, a table of eleven differences with the paper section or source file behind each cell and the Engram file or ADR behind each Engram cell, what the neighbours mean for H1, H2 and H4, and four corrections to the literature notes.

**Why.** Card R3: HEAMS (2611.20144) and SAFE-Mem (2610.22959) made "the first governance layer over existing stores" untrue, and an examiner will know both papers.

**Result.** Both papers were read from their PDFs (HEAMS v1, 69 pages, body and most appendices; SAFE-Mem v2, all 18 pages), and both repositories at a fixed commit: `milatechtransfer/heams` at dec2874 and `LVenum/SAFE-Mem` at bac6090, both Apache-2.0. Six claims were narrowed, each in its own finding entry.

**Consequence.** The README, `docs/architecture.md` and the thesis point at one statement of the claim.
