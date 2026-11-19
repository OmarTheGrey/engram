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
  - "git show origin/l3-model-lints:packages/core/src/lint/model.ts"
supersedes: docs/log/2026-11-19-l2-decision-pair-labels.md
---

**What.** Each label carries `finding_on`, the item a finding of its lints lands on: the labelled item, except that for a pair L3's contradiction lint judges it is the later item of the pair by id.

**Why.** L3 flags the later item of a contradicting pair, naming the earlier. A conflict's restatement is written after its first statement, so it is both the fault and the later item. A superseded statement is the earlier of its pair, and ids follow write order, which follows time; making it the later id would mean writing it after the update that supersedes it. So the label stays on the stale statement, the faulty one, and `finding_on` names the later update the lint flags, with the stale statement as its evidence.

**Result.** For 500 superseded faults `finding_on` is the update; for every other label it is the labelled item.

**Consequence.** L4 matches a model finding by `finding_on`, not `item_id`.
