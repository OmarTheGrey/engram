---
date: 2026-10-22
author: omar
type: milestone
card: S0.13
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/step-0.md
  - docs/decisions/README.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** Step 0 finished: S0.13 decided ADRs 0002 to 0023 except 0020, gave every roadmap card a file under `docs/tasks/` (61 from the roadmap, four rewritten for ADR 0001, five added: PX1 to PX3, RN1, RN2), and the outcome table in `docs/tasks/step-0.md` records every task.

**Why.** The exit criterion of step 0 is that every convention runs in CI and every proposed decision is made before E0.2.

**Result.** 94 checks pass in `scripts/test/tasks-and-decisions.test.ts`. Two items remain with the lead: the MPBench contact date and ADR 0020 (the roadmap says MIT, the ADR recommends Apache-2.0).

**Consequence.** Work continues at E0.2's successors on the critical path: E0.3, E1.2, A1.
