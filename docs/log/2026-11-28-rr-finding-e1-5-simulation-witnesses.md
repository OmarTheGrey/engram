---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.5
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - specs/README.md
  - "make verify-spec"
  - docs/log/2026-11-21-e1-5-measurement-simulation-fix-pass.md
supersedes: docs/log/2026-11-21-e1-5-measurement-simulation-fix-pass.md
---

**What.** Card E1.5's simulation witnesses after its fix pass, restated as a finding: they come from `make verify-spec`, a check of a model, not from a research script and config.

**Why.** Typed as a measurement with no MANIFEST row, the entry made `make thesis` fail.

**Result.** As the superseded entry records, over 5,000 traces of 60 steps at each of seeds 1, 2 and 3: a stale writer refused 2135, 2094, 2092; a withdrawal 73, 54, 58; a writer in flight across an erasure 83, 76, 95; a sweep deletion 120, 117, 120; adoption refusing an erased or swept id 12, 6, 17; a write under an erased id refused 27, 36, 31; a report closing an earlier mark 138, 138, 128; adoption kept the plane's kind above import 20, 28, 15; the put-back 0 each. No property failed.

**Consequence.** The put-back still needs its scenario tests.
