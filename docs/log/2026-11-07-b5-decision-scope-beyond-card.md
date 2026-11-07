---
date: 2026-11-07
author: claude-agent
type: decision
card: B5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/B5.md
  - packages/runner/src/longmemeval-probe.ts
  - packages/runner/scripts/run.ts
  - Makefile
  - packages/cli/test/doctor-review.test.ts
supersedes: none
---

**What.** Card B5's change goes beyond the card's files (`bench/longmemeval/`, other packages out of scope): it adds the runner's LongMemEval probe and its branch in `run.ts`, a `make bench` branch and a `make fixtures` step, the AGENTS.md command line, and one changed CLI test.

**Why.** The lead's delegation list defines step 9 as done when "a runner config replays from cassettes through the plane on fake, Mem0 and Letta", which needs the runner; the card predates the runner (RN1). AGENTS.md asks for every new command in the Makefile and in its list in the same PR. The CLI test used `longmemeval` as its example of an unvendored benchmark (failure entry `2026-11-07-b5-failure-doctor-test-fixture-name.md`).

**Result.** Each change outside `packages/bench` is the smallest that wires the harness in; none touches core, adapters or the policy.

**Consequence.** The reviewer checks these files against the card as well as the bench.
