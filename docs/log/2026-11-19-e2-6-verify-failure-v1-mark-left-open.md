---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** Verification finding V-1: after an offboarding stopped past its mark (a handover's store failure), a rerun's report closed only its own mark, so the person scope stayed frozen for good and crash-left records were refused but never deleted.

**Why.** The review fix pass for P50-5 matched each mark with its own report only, which a rerun cannot satisfy for a mark whose offboarding never reports.

**Result.** Probe V1 failed before the fix and passes after on SQLite and embedded Postgres.

**Consequence.** See the decision on closing marks.
