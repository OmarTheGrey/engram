---
date: 2026-11-22
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/supersede-leak.test.ts
  - packages/cli/test/supersede.test.ts
supersedes: none
---

**What.** Three slips in the fix pass. The leak property's refusal comparison first collided two placeholders, when the start and the accepted id were the same id. A script wrote a real newline into a test's string literal. And `startsWith` was called on the content union, which tsc rejects.

**Why.** Each was found by its own run: an assertion failure, a parse error, and TS2339.

**Result.** The comparison uses two distinct unknown ids, the literal was repaired, and the content is read as a string. tsc prints nothing.

**Consequence.** None.
