---
date: 2026-11-21
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/contract.test.ts
supersedes: none
---

**What.** The inherited supersede route had no contract test, so 'every route of the table was hit above' failed.

**Why.** Card E8.1's contract test requires every route to be exercised.

**Result.** `pnpm exec vitest run packages/server/test/contract.test.ts` gave 1 failed, 26 passed. Four supersede tests were added, after which the file passes.

**Consequence.** None.
