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

**What.** Review finding L5-2: the pruning `words < WORD_SHINGLE_FLOOR / threshold` bounded word counts, while the Jaccard bound is on shingle set sizes, so a 31-word text and the same text with seven words added (character 3-gram Jaccard over 0.9, cosine 1) got no candidate.

**Why.** Seven short repeated words add few new 3-grams but many words.

**Result.** The pair is a test and is now flagged; see the superseding decision on shingles.

**Consequence.** Nothing else.
