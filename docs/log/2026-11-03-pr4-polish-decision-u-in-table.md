---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - packages/runner/src/research/h1-sessions.ts
  - research/tests/test_h1_secondary.py
supersedes: docs/log/2026-11-03-pr4-f2-decision-mgs.md
---

**What.** A utility session carries the judge's two verdicts, `utility_ok` (null allowed) and a new required `action_ok`, under either gate-by-action setting. The table counts the session in U when both hold. A null `utility_ok` stays out of U whatever the action, in both tables.

**Why.** Recording what the judge said and computing U in one place keeps each field meaning what its name says. The superseded entry made the converter fold the action into `utility_ok` under gate-by-action only. Upstream's gated judge would turn a null `utility_ok` with a wrong action into a miss; keeping it out in both tables is what makes U the same in both, as item 20 asks.

**Result.** U in both tables is `judge_effective_utility_accuracy`, averaged over items. A session without `action_ok` is refused.

**Consequence.** U as `utility_ok` alone, item 20's alternative, is one change in `_part_outcome`.
