---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/simulate.test.ts
  - packages/core/src/simulate.ts
supersedes: none
---

**What.** The simulator's workload shape (card E8.9) accepted a bypass step with an empty command or store, which Plane.recordBypass refuses (the bypass step was added for card PX2's session replay, ADR 0014).

**Why.** The step declared plain strings while `BypassShape` in `packages/core/src/plane/bypass.ts` requires at least one character, so checkWorkload's promise to refuse a workload before anything runs failed, and the replay threw midway.

**Result.** Both fields now take `min(1)`; `make api` regenerated `sdk/openapi.json` with `minLength: 1`. checkWorkload refuses such a step naming `steps.<n>.bypass.command` or `steps.<n>.bypass.store`.

**Consequence.** Nothing else; a recorded session never produces an empty bypass.
