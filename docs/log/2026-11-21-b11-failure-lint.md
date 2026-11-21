---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/tau2/scripted.ts
  - packages/bench/test/tau2/scripted.test.ts
  - "make lint"
supersedes: none
---

**What.** The first `make lint` failed: tsc could not type `agentSteps`'s `flatMap` over the step union, and biome flagged an unsafe optional chain in the scripted test. The shim's Python failed ruff's line length in four places.

**Why.** The callback's two return shapes were inferred as two array types; the test read a field after `?.[0]`.

**Result.** `agentSteps` returns a named `AgentStep[]`, the test uses `toMatchObject`, and the long Python lines were split. `make lint` then passed (biome, tsc, ruff, mypy), and the 23 tau2 tests still passed.

**Consequence.** None.
