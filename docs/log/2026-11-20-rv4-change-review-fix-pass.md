---
date: 2026-11-20
author: claude-agent
type: change
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
  - packages/core/test/unit/plane/adopt-review.test.ts
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/plane/offboard.ts
  - packages/core/src/plane/adopt.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/events.ts
supersedes: none
---

**What.** The review fix pass of PR #58 (card RV4): findings I-1 to I-9 fixed or documented, and invariants 6 and 7 added.

**Why.** The reviewer's probes P1 to P23 reproduced erased content returning after a move, untested retire guards, an approved item retired over a source the plane set, a silent grant strip, a laundered kind, undocumented churn, a slow check, two untested clauses and a case-sensitive comparison.

**Result.** 15 new tests, each mutation-checked: M1 to M5 and one mutation per fix (F1, F1b, F3, F4, F5, F7, F9) each fail exactly their test; invariants 6 and 7 fail under their mutations. Probes after: P1 one event, P2 denied 4, P4 `model`, P21 kept, P23 kept, P9 4.3 s.

**Consequence.** The twin dogfood's adoption holds its trust and grant rules under hand edits and a move.
