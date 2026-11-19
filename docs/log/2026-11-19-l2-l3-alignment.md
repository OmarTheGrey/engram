---
date: 2026-11-19
author: claude-agent
type: change
card: L2
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - "git show b59a1f7~2:packages/bench/src/faults/reach.ts"
  - packages/bench/scripts/fault-set-check.ts
  - packages/bench/test/faults/generate.test.ts
  - "git show origin/l3-model-lints:packages/core/src/lint/model.ts"
supersedes: none
---

**What.** The set is checked against card L3's model-tier rules: every label about `contradiction` must be a pair L3 sends (both active semantic items, among each other's five nearest by shared words), flagged on its later id; every label about `unsupported-claim` must cite an active, reachable source at the recorded strict hash.

**Why.** The coordinator relayed L3's constraints: without them the model tier's recall on the set is zero by construction.

**Result.** Contradictory and unsupported-claim faults were already semantic items with item-citing provenance. Two changes: labels gain `finding_on`, and the superseded near-miss keeps its attribute. The check script now fails unless all model-tier faults and near-misses are sent; on the fixture set 60 of 60 faults and 60 of 60 near-misses are.

**Consequence.** L4 scores the model tier on `finding_on`.
