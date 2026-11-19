---
date: 2026-11-19
author: claude-agent
type: change
card: L4
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/runner/src/lint-fault-set.ts
  - packages/runner/scripts/lint-fault-set.ts
  - packages/runner/test/lint-fault-set.test.ts
supersedes: none
---

**What.** A runner entry point that lints card L2's seeded-fault set with both tiers: `benchmark: "fault-set"` configs for run.ts (pipeline, live, replay, count), and a deterministic-only entry point that also records the units card L3's lints would send.

**Why.** Card L3's lint runner reads its own fault fixtures, not L2's states; H3 measures the lints on L2's set (plan section 7, PR 4).

**Result.** Each state is appended to a fresh log and `Plane.lint` runs over every scope under the set's policy; rows carry findings by tier, whether each lands on a base item, and every unit's outcome. No label is read. Nine vitest tests, among them: the floor flags exactly the keyed faults of the fixture set (mutation-checked by breaking the base-item rule), and the pipeline replay equals a recording from its script.

**Consequence.** The scorers join labels in Python; the live run is one `make run`.
