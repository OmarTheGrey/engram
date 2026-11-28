---
date: 2026-11-28
author: claude-agent
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane/revalidate.ts
  - packages/core/test/unit/distill/drift.test.ts
supersedes: docs/log/2026-11-28-d4-decision-events-and-restore.md
---

**What.** A drift restore goes through the promotion path: `restoreRetired` in `plane/promote.ts` judges the drift-retired item as the candidate it was, with the presented replay, and commits the in-place promotion (version plus one, active) under `<policy>/drift/restored`.

**Why.** Review finding 3, decided by the orchestrator: the first restore was a direct status rewrite that skipped the budget check, expiry and the gates later cards add (D5's safety hold, E2.19's approval). Through the gate they all apply.

**Result.** Tested: a restore the budget refuses (`engram/write/downgrade`), an expired one (`engram/promote/expired`), 3 of 5 (`engram/promote/no-evidence`), and no restore after a ttl, eviction or offboarding. A drift-retired procedure's content counts as retired (ADR 0025): a model rewrite is refused under `engram/write/retired-content`, and the restore leaves its own retirement out. `promote.ts` gains one optional parameter and one function.

**Consequence.** D5 and E2.19 judge a restore without touching `revalidate.ts`.
