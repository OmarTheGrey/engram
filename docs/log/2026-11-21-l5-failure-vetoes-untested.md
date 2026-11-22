---
date: 2026-11-21
author: claude-agent
type: failure
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: none
---

**What.** Review finding L5-1: deleting the number veto or the rare-term veto from `precisionVeto` left every test passing, and over the catalogue the number veto fired 0 times.

**Why.** The vetoes had unit tests as functions but no pair that only one of them stops ran through the pass.

**Result.** Two pass tests now: a room changed from 4 to 5 in a scope of 22 items where both numbers are common, and a 46-word text with one rare word swapped, cosine at 0.85 or above. Each deletion now fails its test.

**Consequence.** Nothing else.
