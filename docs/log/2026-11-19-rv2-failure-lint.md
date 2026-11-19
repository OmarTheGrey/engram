---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_h1_pipeline.py
  - "make lint: 1 file would be reformatted; then mypy: test_h1_pipeline.py:370: Returning Any from function declared to return str"
supersedes: none
---

**What.** `make lint` failed twice on my pipeline test before passing.

**Why.** First, ruff format wanted a wrapped assertion on one line. Then mypy flagged the test helper `refused` for returning `CalledProcessError.stderr`, which is typed Any.

**Result.** I ran `uv run ruff format research` and wrapped the return in `str(...)`. `make lint` then passed: biome, tsc, ruff and mypy ("Success: no issues found in 54 source files").

**Consequence.** Nothing.
