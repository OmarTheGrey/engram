---
date: 2026-11-22
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/distill/skill.test.ts
  - "pnpm exec biome check packages/core/test/unit/distill/skill.test.ts"
supersedes: none
---

**What.** `make lint` after the merge reported biome's `useTemplate` on a string concatenation in the skill test.

**Why.** `biome check --write` applies only safe fixes, and this one is marked unsafe, so it stayed an info that the first lint runs did not stop on.

**Result.** Commit `2f75f61a` uses a template literal. biome reports nothing on the file.

**Consequence.** None.
