---
date: 2026-11-19
author: claude-agent
type: finding
card: L4
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/bank.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The generator's injected sentences open with recognisable phrases ("For the record, my ...", "As it stands, my ...", "These days my ...") that LongMemEval's own turns lack, so a model can tell an injected item from a base one.

**Why.** Found by the review of PR #49. The pools are cue-free between a fault and its near-miss (L2's restatement-pool decision), not between injected and natural text.

**Result.** Under L3's planning every unit judges an injected item: contradiction pairs only semantic items, which base turns are not, but an unsupported-claim unit's source can be a base turn. A model, or a reader, seeing both could tell them apart by the opener. L2's generator is not changed here.

**Consequence.** A backlog row for card L2.
