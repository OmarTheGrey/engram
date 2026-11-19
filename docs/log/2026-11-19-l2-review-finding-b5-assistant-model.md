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
  - packages/bench/src/longmemeval/plane.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-19-l2-finding-b5-assistant-provenance.md
---

**What.** B5's `turnItem` leaves the assistant turns' model unset, so card L1's missing-provenance lint flags every assistant turn of B5's LongMemEval state.

**Why.** L1 defines missing-provenance as a model write naming no model, and B5 writes assistant turns as `kind: model` with none. The fault set names one (decision `2026-11-19-l2-review-decision-assistant-model`), so the count is recorded, not shown.

**Result.** 124,334 of 246,750 turns of the cleaned S split (`research/results/h3-fault-set.json`, `base.missing_provenance_as_b5_writes_it`, counted by L1's own `missingProvenance` on B5's items).

**Consequence.** For B6 and X10, the lead's choice (backlog row "B5's assistant model"): B5 names the model, which changes its events and cassette keys, or C6 leaves missing-provenance out on LongMemEval. Otherwise C6 flags half of what it reads.
