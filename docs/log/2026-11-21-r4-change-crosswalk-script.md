---
date: 2026-11-21
author: claude-agent
type: change
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/crosswalk.py
  - research/tests/test_crosswalk.py
  - "uv run pytest -q research/tests/test_crosswalk.py"
supersedes: none
---

**What.** `research/scripts/crosswalk.py` turns `research/configs/crosswalk.json` into `research/results/h1-crosswalk.json` and the thesis table in `docs/compliance/README.md`, and exits 1, writing nothing, when a named test does not exist.

**Why.** Card R4: an examiner can ask which claim is backed by which test and which obligation it bears on; the answer was spread over the suite.

**Result.** The check parses each test file's `describe`, `it` and `test` titles as plain text (constants, `+` joins, `.each` string rows; `.skip`, `.todo` and `.fails` are no evidence), nesting read from indentation. The config is refused when a relation is anything but "bears on" or a row's wording reads as a compliance claim. `--legal` checks each quotation against the Official Journal text, by article, paragraph and point. 45 tests pass in `research/tests/test_crosswalk.py`.

**Consequence.** Renaming a test the crosswalk names fails `make test-repro` and `make test` until the config follows.
