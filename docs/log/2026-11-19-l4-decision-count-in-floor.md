---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/h3_lint_floor.py
  - research/results/h3-lint-floor.json
supersedes: none
---

**What.** The floor result also holds the live model run's call count (`model_run`), from the units planned in the same pass, rather than a result of its own.

**Why.** Planning needs every state loaded, as the floor does; a second result would lint the 500 MB set twice under `make test-repro`. `make run ... COUNT=1` gives the same count from the runner, and a test checks they agree on the fixture set.

**Result.** 95,217 calls, both ways.

**Consequence.** If the lead wants the count apart, it splits out without new code.
