---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
supersedes: none
---

**What.** Review finding M8 of PR #44: running no budget check on a grant change was a decision with no log entry.

**Why.** It was stated in ADR 0034 and in a code comment only.

**Result.** Decision `2026-11-19-e9-4-review-decision-no-budget-check.md`.

**Consequence.** None.
