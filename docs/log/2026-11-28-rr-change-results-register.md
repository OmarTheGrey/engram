---
date: 2026-11-28
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/research/results.md
  - research/scripts/results_register.py
  - research/tests/test_results_register.py
  - Makefile
  - AGENTS.md
  - docs/README.md
supersedes: none
---

**What.** Added the results register `docs/research/results.md`, its script, config and test, the `make results-register` target, its AGENTS.md command line (CLAUDE.md copied) and a row in `docs/README.md`'s registers.

**Why.** No single page said which research results exist, what each answers, whether it is a hypothesis result, and which entries record it.

**Result.** Before: results were findable only through `research/results/MANIFEST.md` and the log. After: one section per MANIFEST row, grouped by hypothesis, each with its question, status, pre-registration section, headline values read from the file with their key paths, and its current measurement entries; a top section says no hypothesis has a result yet and what H1 to H5 still need.

**Consequence.** `research/tests/test_results_register.py` keeps the register current.
