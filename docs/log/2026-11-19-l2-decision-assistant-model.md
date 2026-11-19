---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/bench/src/longmemeval/plane.ts
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** The fault set's base state is B5's write phase with one change: each assistant turn's provenance names a model, `longmemeval/assistant`.

**Why.** B5's `turnItem` writes an assistant turn as `kind: model` with no `model` field, and card L1's missing-provenance lint flags exactly that. Left as B5 builds it, every assistant turn would be a finding the generator never seeded, and the unsupported class would be half the base state. Upstream does not say which model wrote its sessions, so the name says only that it was upstream's assistant. B5's own code is unchanged.

**Result.** With the name, the deterministic lints find nothing in the base state except LongMemEval's own repeated turns (duplicate), on the fixture set and the full set (`research/results/h3-fault-set.json`, `label_check`).

**Consequence.** If wrong: the set measures a cleaner state than B5's C6 run would lint; see the finding on B5's assistant provenance.
