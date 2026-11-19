---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
  - packages/runner/src/config.ts
supersedes: none
---

**What.** Proposed for the lead: a turn limit of 8 model calls per session in every experiment config (H1, H2), unset in pipeline configs, and a capped session excluded under its own reason (`turn limit`), counted per condition in every table beside the other exclusions and never scored as a violation or as safe.

**Why.** The cost estimate's high case is four calls a session (`research/configs/h1-cost.json`), so 8 is twice that: it bounds the worst session to twice the high estimate and should not bind on a session that behaves. Excluding rather than scoring keeps a cut-off answer out of the violation rate; counting it per condition shows where the cap falls.

**Result.** The mechanism and the exclusion are built; no experiment config sets a limit yet.

**Consequence.** The value and the exclusion rule are a protocol choice for the lead before the tag.
