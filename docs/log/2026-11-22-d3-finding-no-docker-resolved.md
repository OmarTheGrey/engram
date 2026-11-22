---
date: 2026-11-22
author: claude-orchestrator
type: finding
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/test/unit/distill/skill-spec/cases.json
  - scripts/test/no-docker.test.ts
supersedes: docs/log/2026-11-22-d3-finding-d2-no-docker-test.md
---

**What.** The no-docker test failure this branch inherited from card D2's skill-spec fixture no longer occurs.

**Why.** D2 reworded its `optional-fields` case to name no container runtime and regenerated the validator's output before merging to main (#98). This branch then merged main (`0ce8a09f`) and took D2's final fixture unchanged.

**Result.** `pnpm exec vitest run --project scripts` passes 192 of 192 on this branch, no-docker included.

**Consequence.** Nothing is left for D2 or D3 to fix here.
