---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-set.json
  - packages/core/policies/medium.yaml
  - packages/bench/src/longmemeval/plane.ts
supersedes: none
---

**What.** Under preset medium, part of LongMemEval's S histories is past its validity at the question's read time.

**Why.** Medium retires person-scope episodic items after 90 days (`ttl: 7776000`), and B5 writes every turn as an episodic item dated by its session; the read is at the question's date (B5's `readTime`). The fault set drops that ttl, so the number was counted while building it.

**Result.** 11,122 of 246,750 turns, in 54 of 500 questions, are past medium's ttl at the read time (`research/results/h3-fault-set.json`, `base.past_medium_ttl`).

**Consequence.** On those 54 questions B5's C5 read hides the older turns by policy, and C6's expired-validity lint flags them, so H1 to H3 on LongMemEval under medium measure the ttl as well as the gate. For the lead with B6 and X10: keep the ttl (it is the preset), or report the 54 questions apart.
