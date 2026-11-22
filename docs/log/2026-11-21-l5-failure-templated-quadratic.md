---
date: 2026-11-21
author: claude-agent
type: failure
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: none
---

**What.** Review finding L5-4: 4,000 templated items gave about 8 million candidate pairs in 15 seconds; the pass was quadratic on templated text.

**Why.** Templated items share LSH bands, so every bucket held thousands of items and each was read pairwise.

**Result.** With the cap the same corpus takes 253,920 estimates (63.5 per item, 3,935 items capped) in about 0.6 seconds, measured by the new templated test's corpus.

**Consequence.** See the decision on the candidate cap.
