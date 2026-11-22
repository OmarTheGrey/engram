---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/plane/promote.ts
  - packages/runner/src/replay-validate.ts
  - docs/decisions/0045-replay-validation-source.md
supersedes: docs/log/2026-11-22-d3-decision-replay-size-and-draw.md
---

**What.** A replay of other than `replay_n` held-out tasks is denied under `engram/promote/replay-split`. The runner draws the `replay_n` tasks from each candidate's split by the config's `draw_seed`.

**Why.** The superseded entry said the index injection "stands", though it superseded that very entry, and that the size rule closes cherry-picking (review finding D3-15).

**Result.** The plane checks induction tasks through the injected session index (`PlaneDeps.distillTasks`), as `docs/log/2026-11-22-d3-decision-distill-index-injected.md` chose. The size rule narrows cherry-picking but does not close it: the draw stays the caller's, and the plane does not redo it (ADR 0045, point 8).

**Consequence.** A caller who redraws until a set suits it is caught only by comparing its tasks with the config's draw.
