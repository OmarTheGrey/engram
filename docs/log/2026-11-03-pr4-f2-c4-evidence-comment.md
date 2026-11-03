---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/c4-evidence.ts
supersedes: none
---

**What.** The stale doc comment above `walkLists` is moved back above `walkRow`, which had lost it.

**Why.** P4V-8. Deleting the line, as asked, would have left `walkRow` with no doc comment.

**Result.** A comment-only change, but `walkRow` feeds the C4 walk result, so `make test-repro` was run this round.

**Consequence.** None.
