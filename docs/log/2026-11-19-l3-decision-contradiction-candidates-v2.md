---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - docs/readings/litreview/2403.08319-knowledge-conflicts-survey.md
supersedes: docs/log/2026-11-19-l3-decision-contradiction-candidates.md
---

**What.** The contradiction lint pairs each active semantic item held at the lint time with its 5 nearest by the Jaccard share of their terms, ties to the items that follow it in id order, wrapping round; exact duplicates and pairs sharing no term are skipped.

**Why.** Review L3-5: ties by id gave the oldest items every contested slot. The cyclic rule is as cheap and deterministic, and every item gets the same share: with 13 tied items each is in exactly 10 pairs.

**Result.** Fixture units, cassette keys and the pilot count (51 calls) are unchanged.

**Consequence.** Recall is bounded twice: a contradiction sharing no term is never judged, and among more than 5 equally near items only those that follow in id order within 5 are. L4 should report both bounds beside the delta.
