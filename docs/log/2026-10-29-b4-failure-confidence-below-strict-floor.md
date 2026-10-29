---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/mem-inv-bench/plane.ts
  - packages/core/policies/strict.yaml
  - packages/bench/test/mem-inv-bench/plane.test.ts
supersedes: none
---

**What.** The first write phase gave every MEM-INV-Bench entry confidence 0.7, and under `strict` the plane denied every team entry below the 0.8 floor.

**Why.** Upstream has no confidence; 0.7 was picked to clear `medium`'s team floor of 0.6 without checking the other presets.

**Result.** The strict-preset test expected candidates awaiting review and got denials (`below-floor`), so the outcome under `strict` was decided by an invented number rather than by the preset's stance. The constant is now 0.9, above every preset's floor, and the test passes with the team entries as candidates.

**Consequence.** Any constant the harness invents for a benchmark is checked against every preset's thresholds before it is used.
