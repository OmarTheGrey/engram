---
date: 2026-11-21
author: claude-agent
type: change
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "make test-one T=packages/core/test/property/stateful.test.ts"
  - "ENGRAM_STATEFUL_RUNS=2000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: docs/log/2026-11-21-e1-4-stateful-model.md
---

**What.** The stateful model as the review fix pass left it: commands over the live projection, three writers (Dana, her agent, Lee), three scopes, and a replay that works.

**Why.** Review finding E1.4-1: seed and path alone fail with "Unable to replay, got wrong path"; fc.commands also needs its replay path. E1.4-2: most commands named absent items.

**Result.** A failure prints `ENGRAM_STATEFUL_SEED`, `ENGRAM_STATEFUL_PATH` and `ENGRAM_STATEFUL_REPLAY`, then fast-check's report; feeding the three back reproduced a mutant's counterexample exactly, and a vacuity test replays the leaky read's to the same shrunk list. `ENGRAM_STATEFUL_STRICT` (1, or a list such as F1,F3) judges the pinned gaps. Default run 3.2 s; 2,000 runs 45 s, passing.

**Consequence.** A counterexample reported by anyone can be rerun from three printed values.
