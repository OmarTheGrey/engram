---
date: 2026-11-21
author: claude-agent
type: change
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
  - packages/core/test/unit/lint/det.test.ts
supersedes: docs/log/2026-11-21-e2-10-injection-screen.md
---

**What.** The mutation counts of the first entry, corrected and recounted on the fixed code: removing the kind condition fails 13 screen tests and 1 lint test (12 and 1 before this pass, as the review counted); the catch rethrowing, 1; the bound check, 2; the gate's call site, 6; a reason quoting 12 characters of the content, 1 (the strengthened test; none before).

**Why.** Review E2.10-8: the first entry's 8 was wrong.

**Result.** Each mutation was applied, both test files run, the source restored; `git status` showed no stray change.

**Consequence.** None.
