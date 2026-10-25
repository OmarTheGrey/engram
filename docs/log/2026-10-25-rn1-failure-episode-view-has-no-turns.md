---
date: 2026-10-25
author: claude-agent
type: failure
card: RN1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/strip.ts
  - packages/runner/src/gatemem-probe.ts
  - "pnpm exec vitest run packages/runner"
supersedes: none
---

**What.** On its first run, the RN1 probe read the episode's turns from B1's agent view of the episode. That view has no turns, so 4 of the 5 acceptance cases failed with a TypeError.

**Why.** B1 strips turns from the episode an agent receives at reset, so that no agent can read past its checkpoint. The runner is the harness, not the agent.

**Result.** The probe now takes the turns from the full episode, up to the checkpoint's as-of turn, and passes each one through `visibleTurn`. That matches GateMem's ingestion order. A mutation check followed: loading the ungoverned tools for C5 failed 5 tests, and dropping C3's policy marker failed 1.

**Consequence.** Only the harness reads the full episode. What the session shows the model is still the stripped view.
