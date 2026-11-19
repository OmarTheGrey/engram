---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-set.json
  - fixtures/fault-sets/longmemeval/README.md
supersedes: none
---

**What.** Review finding L2-3 on PR #46: how the set's base state and policy differ from what B5, B6 and X10 run was stated only in log entries.

**Why.** The set names the assistant model on B5's turns and lints under preset medium without its person-scope ttl; a reader of the result or the fixture would not see either.

**Result.** The result's `limits.differs_from_b5_b6_x10` and the fixture README now state the assistant model, the ttl, the turns past medium's ttl, and how many labelled model units L3's planning would not send under medium, counted by the check script with L3's merged `heldAt` rule.

**Consequence.** Whoever compares the set with B5's runs reads the differences in the result itself.
