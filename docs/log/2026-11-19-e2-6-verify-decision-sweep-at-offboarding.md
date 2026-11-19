---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/src/plane/adopt.ts
  - docs/decisions/0010-retention-retires.md
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: docs/log/2026-11-19-e2-6-review-decision-purge-at-adoption.md
---

**What.** The offboarding deletes, before its report, what the person scope's store holds under an id the log never allowed or an erased id (`engram/offboard/swept`); adoption purges erased and swept ids; a record appearing after the report is adopted as the person's.

**Why.** V-5: the plane accepts a write into an offboarded scope, so a hand-written record there must be accepted too. Refusing every later write would be a policy change for the lead, recorded as an open question in ADR 0010.

**Result.** V1, V5 and RV3 pass; turning the sweep off fails eight tests.

**Consequence.** A crashed write landing after the sweep is adopted as the person's.
