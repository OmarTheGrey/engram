---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/policies/medium.yaml
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** Two GH-39 control cases first failed: they expected a model-labelled write into team scope under preset medium to be denied by `engram/write/source-isolation`.

**Why.** The write gate checks the scope rule's `allowed_sources` before source isolation (`evaluateWrite`, `packages/core/src/policy/evaluate.ts`), and medium's team rule does not list `model`, so the rule itself denies first.

**Result.** The run reported "Tests 2 failed | 162 passed (164)", received `preset.medium/write/team`. The expectation was wrong, not the plane: the cases now assert that rule id and the reason "source model is not allowed in team scope".

**Consequence.** Under the registered presets, source isolation never decides a write outside person scope, since no preset admits model, compaction or external there.
