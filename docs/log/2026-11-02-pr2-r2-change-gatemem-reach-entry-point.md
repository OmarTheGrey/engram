---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/gatemem-reach.ts
  - packages/runner/scripts/gatemem-reach.ts
  - packages/runner/test/research/gatemem-reach.test.ts
supersedes: docs/log/2026-11-02-pr2-gatemem-reach-entry-point.md
---

**What.** The GateMem reach entry point as it stands after both review rounds.

**Why.** Its first-pass entry described only the leak targets.

**Result.** `reachOf` is unchanged: it strips hidden fields through the bench's `mapCheckpoint`, writes each turn through `Plane.write` and reads as the asker. `scoreReach` counts both the leak targets and GateMem's scored pattern set (`not_include` too for access checkpoints), scores each plain refusal of the config with the scorer, and returns every scored pattern and every match with its first readable turn. Tests cover a `not_include` pattern in reach, a refusal scored as a leak, and the scorer's context leak firing exactly when a scored pattern is in reach.

**Consequence.** None.
