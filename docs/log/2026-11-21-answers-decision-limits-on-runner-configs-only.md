---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/config.ts
  - packages/runner/src/lint-faults.ts
  - packages/runner/src/lint-fault-set.ts
  - research/tests/test_run_limits.py
supersedes: none
---

**What.** The turn limit and the spend ceiling are set in the runner's four experiment configs only: H1's two arms and H2's two LongMemEval baselines, not the smoke, B1 and fixture pipeline configs, and not the two model-lint configs.

**Why.** Item 4 names experiment configs. The pipeline configs carry their own ceilings already and run no registered sample. The lint configs' schemas (`LintRunnerConfig`, `FaultSetLintConfig`) are strict and have neither field, so writing one would make them unreadable; changing the schema is code, outside this card.

**Result.** `test_run_limits.py` fails if a new experiment config of the runner lacks either value; the lint runs' missing ceilings are a backlog row.

**Consequence.** If the smoke run should mirror H1's turn limit, it is one line in each smoke config.
