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

**Result.** Tests: a restore the budget refuses (`engram/write/downgrade`), an expired item not restored (`engram/promote/expired`), 3 of 5 refused under `engram/promote/no-evidence`, and ttl-, eviction- and offboarding-retired procedures not restored. While drift retired, the content counts as retired in its scope (ADR 0025), so a model rewrite is refused under `engram/write/retired-content`; the restore leaves its own retirement out. A drift retirement is matched by rule suffix under any policy id (finding 5). The edit to `promote.ts` is one optional parameter and one exported function.

**Consequence.** D5 and E2.19 judge a restore without touching `revalidate.ts`.
