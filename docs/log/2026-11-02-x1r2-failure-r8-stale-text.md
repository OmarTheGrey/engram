---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/x1-gatemem.test.ts
supersedes: none
---

**What.** The header of `x1-gatemem.test.ts` and the PR body's Plan and Evidence still described C4 with the RAG-Policy verdict.

**Why.** They were not revisited when the default changed.

**Result.** Both describe the current C4.

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.
