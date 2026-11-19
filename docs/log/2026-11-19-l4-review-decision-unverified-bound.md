---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/lint_scores.py
  - research/results/h3-lint-floor.json
supersedes: docs/log/2026-11-19-l4-decision-unverified-bound.md
---

**What.** Precision with the unverified findings stays in the result as a bound, TP / (TP + FP + U) to (TP + U) / (TP + FP + U), described as what it is: a pooled figure, not precision on natural memory.

**Why.** Review finding L4-3: TP is the injected faults found, fixed by the generator's rate, so the lower end, 0.721 on the floor, would be 0.838 at `per_question` 2.

**Result.** The natural-memory figure is each lint's own bound on its base findings, 0 to 1 for the duplicate lint's 967, in the result's `natural_memory`.

**Consequence.** Only the judged audit sample narrows natural-memory precision.
