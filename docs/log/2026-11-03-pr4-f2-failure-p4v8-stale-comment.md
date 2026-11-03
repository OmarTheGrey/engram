---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/c4-evidence.ts
supersedes: none
---

**What.** `c4-evidence.ts` had two doc comments above `walkLists`, the first a stale copy (P4V-8).

**Why.** When `walkLists` was factored out of `walkRow` in the review fix pass, `walkRow`'s one-line doc comment stayed above the new function.

**Result.** The line is back above `walkRow`, where it belongs (`2026-11-03-pr4-f2-c4-evidence-comment`).

**Consequence.** After extracting a function, read the comments on both sides.
