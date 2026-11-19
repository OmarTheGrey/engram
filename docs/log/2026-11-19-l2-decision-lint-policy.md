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
  - packages/core/policies/medium.yaml
  - fixtures/bench/longmemeval-faults/policy.json
supersedes: none
---

**What.** The set is written under policy `longmemeval.lint-set` version 1 and linted under version 2: preset medium with no ttl in the person scope and every lint enabled; version 1 lets the role scope take episodic items, version 2 forbids them as medium does. The user gets a role scope, `role:user`, beside B5's `person:user`.

**Why.** Medium's 90-day person ttl would put base turns past their validity at the lint time, so expired-validity would fire on turns nobody seeded. A scope-class mismatch arises only when a policy tightens after a write (as in card L1's fixture), and B5's state has one scope; ADR 0021 gives a person a role scope.

**Result.** On the full set the dropped ttl concerns 11,122 turns in 54 questions (`research/results/h3-fault-set.json`, `base.past_medium_ttl`).

**Consequence.** If wrong: L4 lints under a policy that is not exactly a preset; its precision says nothing about medium's ttl.
