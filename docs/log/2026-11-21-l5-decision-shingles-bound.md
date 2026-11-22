---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: docs/log/2026-11-21-l5-decision-shingles.md
---

**What.** Supersedes the shingles decision of this date: a pair is still compared by the kind of its shorter text, but every text under 32 words gets a character signature, every longer one a word signature, and a longer one also a character signature when its character 3-gram set has at most M / threshold members, M the largest set of a shorter text in its class.

**Why.** Jaccard is at most the ratio of two set sizes; the earlier rule bounded word counts instead (review finding L5-2). Character shingles are now code points (L5-7).

**Result.** The 31-word pair is flagged. The subject and object swap figure (character 3-gram similarity 0.64 for "Alice reports to Bob" and its swap) is now a test, and so is the known limit that a swap inside a long sentence is flagged.

**Consequence.** Nothing else.
