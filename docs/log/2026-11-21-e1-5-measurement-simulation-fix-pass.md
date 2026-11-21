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
supersedes: docs/log/2026-11-21-e1-5-measurement-simulation.md
---

**What.** The simulation's witnesses after the fix pass, 5,000 traces of 60 steps at each of seeds 1, 2 and 3.

**Why.** The fix pass added an action and record fields, so the earlier counts no longer describe the model.

**Result.** Per seed (1, 2, 3): a stale writer refused 2135, 2094, 2092; a withdrawal 73, 54, 58; a writer in flight across an erasure 83, 76, 95; a sweep deletion 120, 117, 120; adoption refusing an erased or swept id 12, 6, 17; a write under an erased id refused 27, 36, 31; a report closing an earlier mark 138, 138, 128; adoption kept the plane's kind above import 20, 28, 15; the put-back 0 each. No property failed. A check of a model, not a research result, so no MANIFEST row.

**Consequence.** The put-back still needs its scenario tests.
