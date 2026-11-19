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
  - packages/bench/scripts/fault-set-check.ts
  - packages/core/src/lint/model.ts
supersedes: none
---

**What.** Under preset medium, card L3's planning would not send some of the set's labelled model units.

**Why.** Review finding L2-3 asked for the count after the rebase. L3's merged `heldAt` rule skips a claim whose source is past its ttl, and medium retires person-scope episodic items after 90 days; the set's asides are episodic.

**Result.** With every lint enabled under medium, 45 of the 1,000 labelled unsupported-claim units (faults and near-misses) and 0 of the 2,000 contradiction units would not be sent (`research/results/h3-fault-set.json`, `label_check.model_labels_not_sent_under_medium`). The review counted 51 on the set before the fix pass; the hardened set places its asides afresh, so the count moved. Under the set's own policy all are sent.

**Consequence.** Stated in `limits.differs_from_b5_b6_x10`; L4 lints under the set's policy.
