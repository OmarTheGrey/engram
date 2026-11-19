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
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** B5's LongMemEval state, linted as it is, would flag every assistant turn with the missing-provenance lint.

**Why.** B5 writes assistant turns with provenance `kind: model` and no `model` field (`turnItem`), and card L1 defines missing-provenance as a model write naming no model. The fault set names one to keep its base state clean (decision entry `2026-11-19-l2-decision-assistant-model`).

**Result.** On the cleaned S split that is 124,334 of 246,750 turns over 500 questions (`research/results/h3-fault-set.json`, `base.assistant_turns_model_named` and `base.turns`).

**Consequence.** Card X10, H3's C6 on LongMemEval, lints B5's state: unless B5 names the assistant's model, or C6 leaves missing-provenance out on LongMemEval, about half of what it reads is flagged. A one-line change to `turnItem` for the lead or B6 to decide; it changes B5's events and so its cassette keys.
