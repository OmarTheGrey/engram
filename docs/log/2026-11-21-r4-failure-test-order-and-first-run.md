---
date: 2026-11-21
author: claude-agent
type: failure
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_crosswalk.py
  - "uv run pytest -q research/tests/test_crosswalk.py"
supersedes: none
---

**What.** The parser of `research/scripts/crosswalk.py` was drafted before its tests, against the brief's test-first rule, and the first run of the tests failed twice for reasons in the tests.

**Why.** The title grammar was worked out by reading the repository's test files first. On the first run, a planted legal text written with `write_text` got Windows line endings and so a different sha256, and one case expected a test under a block the row did not name to be refused, which the chosen rule (unnamed blocks are not checked) allows.

**Result.** The fixture is written as bytes and the case moved to the expected passes. Each key test was then mutation-checked against the script (see the PR's checklist).

**Consequence.** None for the result; the order is recorded so the disclosure in AGENTS.md stays true.
