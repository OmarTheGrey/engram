---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - packages/bench/src/gatemem/judge.ts
  - packages/bench/src/gatemem/score.ts
supersedes: docs/log/2026-11-03-pr4b-fr-decision-utility-checkpoints.md
---

**What.** Recommended, for the lead's decision: H1's GateMem run keeps the 728 utility checkpoints, and MGS's U is upstream's effective utility, answered with the right action and judged complete (decision sheet item 20); changed from `utility_ok` alone.

**Why.** the last verification of PR #27 (F-5): `utility_ok` alone is neither upstream's U nor the paper's Eq. 10. Upstream's rule scorer marks utility wrong unless the action is `answer`, and `promoteJudgeMetrics` uses `judge_effective_utility_accuracy`, `utility_ok` and `action_ok`.

**Result.** Item 14 keeps the wrong action out of A and F because C5's withholding turns a refusal into "no record"; that does not carry to U, whose expected action is `answer` in every condition. Both tables then share U. The pipeline applies the action to U only under gate-by-action today, so accepting this changes `gatememUtility` and its tests before the tag.

**Consequence.** v1 and the sheet say the run's `summary.json` MGS is a different figure.
