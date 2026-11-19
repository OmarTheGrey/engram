---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - packages/core/test/unit/plane/cross-handle-review.test.ts
supersedes: docs/log/2026-11-19-e2-6-review-decision-mark-per-report.md
---

**What.** A report closes its own mark and every mark open when that mark was appended.

**Why.** A rerun must reopen a scope a stopped offboarding froze. For overlapping offboardings this reopens the scope at the later report; the earlier one still deletes only what it read at its mark, so a later write stands and nothing erased returns, which RV1b now asserts.

**Result.** V1 passes; closing only the named mark fails V1, RV1b and the walk.

**Consequence.** None.
