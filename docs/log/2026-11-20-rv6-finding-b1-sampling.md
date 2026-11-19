---
date: 2026-11-20
author: claude-agent
type: finding
card: RV6
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - fixtures/bench/gatemem/run-config.json
  - packages/runner/src/conditions.ts
  - packages/bench/scripts/run-gatemem.ts
supersedes: none
---

**What.** The B1 reference run goes through the runner's C1, which sends no temperature (pi sets only thinking off), while card B1's port of the reference agent runs at temperature 0.2 and 4,096 tokens.

**Why.** The B1 harness (`packages/bench/scripts/run-gatemem.ts`) wires only scripted models; the runner's C1 is GateMem's long-context prompt (ADR 0031, decision 3) and the only live path, so B1 uses it.

**Result.** The prompt, the memory block (the last 300 turns), the judge and its scoring are B1's port; the temperature is the provider's default (`packages/runner/src/conditions.ts`). The proposed tolerance's 3-point margin covers this in part, not by measurement.

**Consequence.** Backlog row: a temperature for C1 (a cache key change for C1) or a live path for the B1 harness, if the lead wants the reference run at upstream's sampling.
