---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/retrieval-floor.ts
  - packages/runner/test/retrieval.test.ts
  - "node packages/runner/scripts/retrieval-floor.ts .engram/upstream/gatemem/bench/data"
supersedes: none
---

**What.** With the shared pipeline, C2 finds memory for every GateMem checkpoint's own question, and its top 20 holds what the question is about on most of them.

**Why.** Review round 2 (R1) asked for a floor: C2 must find memory about as often as the history holds the question's leak target or answer.

**Result.** Fixture: C2 returns items for 20 of 20 questions and the history holds the target on 20 (`retrieval.test.ts` asserts the gap is at most 10 percent). Pinned full set, C2's top 20 holds the target on 713 of 728 utility, 661 of 727 access-control (717 located) and 735 of 763 forgetting checkpoints; C5's top 20 on 631, 256 and 561, the plane admitting a target turn on 646, 260 and 565.

**Consequence.** The every-term rule's floor (C2 empty on 15 of 20 questions) is gone.
