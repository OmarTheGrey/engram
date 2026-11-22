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
  - packages/runner/test/d3-validate.test.ts
supersedes: docs/log/2026-11-22-d3-decision-distill-index-injected.md
---

**What.** The plane denies a replay of other than `replay_n` held-out tasks under `engram/promote/replay-split`. The runner draws the `replay_n` tasks from each candidate's split by the config's `draw_seed`, a seeded Fisher-Yates shuffle.

**Why.** The lead's D3-1 answer fixes n, which also closes the cherry-picking that review finding D3-3 left open. The index injection the superseded entry chose stands.

**Result.** A set of the wrong size is a split problem, and gets no new rule id. The rename rule candidate's split of six tasks draws five: `make test-one T=packages/runner/test/d3-validate.test.ts`, 16 passed.

**Consequence.** The plane holds no task pool and does not redo the draw (ADR 0045, consequences).
