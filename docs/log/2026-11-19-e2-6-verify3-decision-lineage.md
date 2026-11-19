---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/offboard.ts
  - docs/decisions/0010-retention-retires.md
supersedes: docs/log/2026-11-19-e2-6-verify-decision-sweep-at-offboarding.md
---

**What.** Erased content is traced by lineage: a first write or a listed record whose lineage names an erased or swept id is refused, adoption deletes the record, and the sweep lists every scope the log names for such records.

**Why.** A new version under a fresh id names its source in its lineage, which needs no schema change. A fresh-id write decided before the mark is refused by its own check or swept; one that crashed after the sweep with no lineage is not recognisable, and is an open question for the lead.

**Result.** Q2a to Q2d pass; disabling any of the three parts fails tests.

**Consequence.** A committed promotion out of the person scope stays (open question).
