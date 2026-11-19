---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-review.test.ts
  - packages/core/src/plane/lint.ts
supersedes: none
---

**What.** Review finding P50-8: a model lint awaited across an erasure on another handle appended findings about the erased items after their redaction; and the reviewer asked that the erased-id refusal name the person scope only to its members.

**Why.** Lint is not a store write and was left as a backlog row; the reason's rule needed a check.

**Result.** The lint test fails without the fix and passes with it. The reason already named the scope only to members of the erased person scope, not of the scope written (`a write under an erased id is refused` in the cross-handle tests pins it).

**Consequence.** The lint backlog row is closed.
