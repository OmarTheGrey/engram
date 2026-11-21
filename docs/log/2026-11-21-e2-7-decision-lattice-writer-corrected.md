---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/policies/strict.yaml
  - packages/core/policies/medium.yaml
  - packages/core/policies/permissive.yaml
supersedes: docs/log/2026-11-21-e2-7-decision-lattice-writer-and-policy.md
---

**What.** The exhaustive lattice keeps its synthetic policy and its non-owner co-member writer, and a preset block beside it runs the same question under strict, medium and permissive.

**Why.** The superseded entry said a preset "would deny half the cells for reasons other than trust", which suggested the presets protect trusted items. They do not: their team rules admit user, document and tool (and import, outside strict), and a co-member writing as one less trusted than the item rewrites or retires it in every case tested. The synthetic policy is needed only to reach all seven kinds, since no preset admits model, compaction or external outside person scope, nor external anywhere.

**Result.** 22 preset cases, all green, pinning the gap in team and person scope.

**Consequence.** The lattice is the exhaustive shape; the preset block is the evidence that the gap is live in registered policies.
