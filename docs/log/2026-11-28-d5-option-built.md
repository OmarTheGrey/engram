---
date: 2026-11-28
author: claude-agent
type: change
card: D5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/options.ts
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** `procedures.safety_scan` is built: its row of `NOT_BUILT_YET` is deleted, so the loader, `Plane.simulate` and `exportCedar` accept it, and E2.14's tables lose their D5 rows.

**Why.** The addendum: building the option means deleting its row and stating how the Cedar export treats it (ADR 0041).

**Result.** The loader takes off, report and hold; a bare `off` under YAML 1.1 gets the quoting hint; every registered preset leaves it absent (tests in `procedural.test.ts`). `policy/load.ts` needed no change, since the refusal lived in the shared table. `load-options.test.ts` passes, 55 tests.

**Consequence.** Other cards lifting their rows edit the same two tables; the rows are independent.
