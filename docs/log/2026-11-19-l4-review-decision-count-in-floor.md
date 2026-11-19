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
supersedes: docs/log/2026-11-19-l4-decision-count-in-floor.md
---

**What.** The floor result keeps the live model run's call count (`model_run`), from the units planned in the same pass, rather than a result of its own.

**Why.** Planning needs every state loaded, as the floor does; a second result would lint the 500 MB set twice under `make test-repro`. `make run ... COUNT=1` gives the same count, and a test checks they agree on the fixture set.

**Result.** 95,217 calls, both ways. The cost (review finding L4-7): the floor reads `research/configs/h3-lint-model.json`, so any change to it changes the floor's sha256 and needs a regeneration and a MANIFEST row update.

**Consequence.** If that coupling proves a nuisance, the count splits out without new code.
