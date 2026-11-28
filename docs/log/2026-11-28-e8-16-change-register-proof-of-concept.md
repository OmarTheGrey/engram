---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - research/scripts/results_register.py
  - research/tests/test_results_register.py
  - research/configs/results-register.json
  - docs/research/results.md
supersedes: none
---

**What.** The results register gains the status proof of concept, with its test, and a section for `h1-leakage.json`.

**Why.** The addendum asks that a proof-of-concept result enter the register as such, and the register script had no such status.

**Result.** `uv run pytest research/tests/test_results_register.py`: passed with the new test; `make results-register` rewrote `docs/research/results.md`.

**Consequence.** Other cards of the plan add their proof-of-concept rows under the same status.
