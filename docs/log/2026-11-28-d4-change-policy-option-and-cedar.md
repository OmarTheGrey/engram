---
date: 2026-11-28
author: claude-agent
type: change
card: D4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/options.ts
  - packages/core/src/policy/load.ts
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-drift.test.ts
supersedes: none
---

**What.** `procedures.drift` is built: its row in `NOT_BUILT_YET` is gone, the loader requires ADR 0011's two thresholds when it is set, and the Cedar export takes it.

**Why.** Card E2.14's option waits for this card (step 5), and ADR 0041 asks the export to translate faithfully or refuse.

**Result.** The export is faithful: drift is a lifecycle outside the gate, its events set status, and the status rule is exported, so a policy with drift exports the same rules as without (tested). A policy setting drift without `replay-drift.success-floor` or `replay-drift.min-trials` is refused at the line of `procedures.drift`. Registered presets parse to the same bytes (E2.14's hash test passes).

**Consequence.** `Plane.simulate` accepts a candidate with drift; a simulation runs no re-validation.
