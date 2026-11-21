---
date: 2026-11-21
author: claude-agent
type: measurement
card: E1.5
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - make verify-spec
  - specs/README.md
supersedes: none
---

**What.** How often the simulation of the good model reached each race, over 5,000 traces of 60 steps at each of seeds 1, 2 and 3.

**Why.** A passing random simulation means little unless it reaches the cases the properties are about.

**Result.** Per seed (1, 2, 3): a stale writer refused 2079, 2099, 2093; a withdrawal 58, 69, 62; a writer in flight across an erasure 93, 89, 102; a sweep deletion 144, 134, 149; adoption refusing an erased or swept id 19, 15, 19; a write under an erased id refused 32, 27, 31; a report closing an earlier mark 137, 133, 146; an adoption over a user-trust item 91, 121, 85; the sweep's put-back 0 each. No property failed. A check of a model, not a research result, so no MANIFEST row.

**Consequence.** The put-back is covered by the scenario test sweepPutBackTest only, and specs/README.md says so.
