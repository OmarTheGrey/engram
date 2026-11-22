---
date: 2026-11-21
author: claude-agent
type: failure
card: L5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: none
---

**What.** The first 10,000-item test drew words as `w` plus a base-36 counter and gave 77,397 candidate pairs, failing its bound of five per item.

**Why.** Such words share most character 3-grams, so unrelated sentences reach similarities of 0.3 and more, unlike text.

**Result.** Words of 3 to 9 random letters gave 1,351 candidates; the bound is now fewer than one per item.

**Consequence.** The bound states the vocabulary it holds for.
