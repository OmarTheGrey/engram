---
date: 2026-11-19
author: claude-agent
type: change
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/runner/src/lint-faults.ts
  - packages/runner/test/lint-faults.test.ts
  - research/configs/l3-lint-fixture.json
  - research/configs/l3-pilot.json
  - fixtures/cassettes/l3-lint-fixture
  - "make run CONFIG=research/configs/l3-lint-fixture.json"
supersedes: none
---

**What.** The runner gains a `lint-faults` config kind: each model fault fixture is linted per seed by Plane.lint with the config's model behind @engram/model's cache; a pipeline config and the pilot experiment config use it.

**Why.** Plan decision 3 builds the model-based work offline: tests on scripted models and committed cassettes, the live pilot counted by COUNT=1 until the key exists.

**Result.** `make run CONFIG=research/configs/l3-lint-fixture.json` replays 51 cassettes: "model calls: 0 new, 51 from cassettes", rows equal to a fresh recording from fixtures/lint/l3-script.json. The cassettes were recorded by make fixtures' own command (`run.ts --record`). research/configs/l3-pilot.json refuses to run without MODEL= and LIVE=1 or REPLAY=1. 14 runner tests pass.

**Consequence.** The live pilot is one command once the model is named and its key supplied.
