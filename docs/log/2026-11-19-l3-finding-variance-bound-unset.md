---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: evaluation
pillar: plane
hypothesis: H3
evidence:
  - docs/roadmap.md
supersedes: none
---

**What.** The roadmap's risk trigger "model-based lint variance above bound" (L3 pilot) names no bound.

**Why.** The card's acceptance reports the variance; the kill list's response (deterministic lints as the floor, model-based secondary) needs a threshold to act on.

**Result.** Neither docs/roadmap.md nor docs/research/preregistration.md states one; the variance script reports the spread and unit agreement but decides nothing.

**Consequence.** A lead item: name the bound (for example on the seed standard deviation of precision or recall, or on unit agreement) before the pilot runs.
