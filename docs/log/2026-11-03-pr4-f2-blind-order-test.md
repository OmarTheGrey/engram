---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** The blind template's order test recomputes the expected order, the sessions sorted by the sha256 of `${seed}\n${sessionKey}`, and compares the key's and the template's order with it.

**Why.** P4V-1.

**Result.** The mutant ranking by condition first is killed.

**Consequence.** The order rule is pinned by the test, not only described.
