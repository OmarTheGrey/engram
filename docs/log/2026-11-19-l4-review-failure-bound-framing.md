---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-floor.json
  - research/scripts/lint_scores.py
supersedes: none
---

**What.** Review finding L4-3: the entries and PR body read the 0.721 to 1.0 bound as precision on natural memory.

**Why.** 0.721 is 2,500 / (2,500 + 967). The 2,500 true positives are set by the injection rate: at `per_question` 2 the lower end would be 0.838. The bound says nothing about how often the duplicate lint is right on LongMemEval's own items.

**Result.** The result now says so (`by_construction.not_natural_precision`) and gives the natural-memory figure as each lint's own bound on its base findings (`natural_memory`: duplicate, 967 findings, 0 to 1) until the 50-item audit is judged.

**Consequence.** Entries that stated the bound as natural precision are superseded.
