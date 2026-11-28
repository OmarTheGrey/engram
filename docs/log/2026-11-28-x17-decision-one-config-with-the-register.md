---
date: 2026-11-28
author: claude-agent
type: decision
card: X17
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/results-register.json
  - research/scripts/results_page.py
  - research/tests/test_results_page.py
  - "make results-register CHECK=1"
supersedes: none
---

**What.** The page reads the register's config and imports the register's `STATUSES` and `HYPOTHESIS_RESULTS`; the page's own fields (a proof of concept's `title` and `meter`, a row's `cost` key paths) are added to the register's config entries, which the register ignores.

**Why.** Two lists of rows and statuses would drift; one list cannot.

**Result.** `results-page.json` holds only page prose and the register config's path. Tests check the page imports the register's vocabulary by identity and that every row of the page's manifest table has the register's status, hypothesis and the MANIFEST's sha256 and command. The three proof-of-concept sections gained a title and a meter; `make results-register CHECK=1` reports the register current, so no register byte moved.

**Consequence.** A new proof of concept adds a `title` to its register section or the page refuses it.
