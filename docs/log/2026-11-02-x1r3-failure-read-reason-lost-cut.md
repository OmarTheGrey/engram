---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/core/src/plane/read-reason.ts
supersedes: none
---

**What.** Under the core pipeline the read event said "returned 20 of 115 candidates; 0 filtered" and lost the 95 items the read limit cut.

**Why.** Round 2 added the limit without asking what the audit record says about it.

**Result.** The reason records the cut (`x1r3-read-reason-cut`).

**Consequence.** Found by the third review of PR #25 and fixed in its round-3 fix pass.
