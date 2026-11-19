---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/labels.ts
  - packages/core/src/lint/model.ts
supersedes: docs/log/2026-11-19-l2-decision-finding-on.md
---

**What.** Each label carries `finding_on`, the item a finding of its lints lands on: the labelled item, except that for a pair L3's contradiction lint judges it is the later item of the pair by id.

**Why.** L3 flags the later item of a contradicting pair, naming the earlier. A conflict's restatement is written after its first statement, so it is both the fault and the later item. A superseded statement is the earlier of its pair, since ids follow write order, which follows time; the label stays on the stale statement and `finding_on` names the later restatement the lint flags.

**Result.** For the 1,000 superseded labels (500 faults and 500 near-misses) `finding_on` is the later restatement; for every other label it is the labelled item. The superseded entry said 500.

**Consequence.** L4 matches a model finding by `finding_on`, not `item_id`.
