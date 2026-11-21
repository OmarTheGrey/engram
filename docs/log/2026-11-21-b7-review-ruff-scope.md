---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - Makefile
  - pyproject.toml
  - "make lint"
supersedes: none
---

**What.** `make lint` runs ruff check and ruff format on `packages/bench/scripts` as well as `research`.

**Why.** The reviewer's note: MERIT's shim, and B11's, were not linted.

**Result.** The shim passed already. The folder held 24 findings in two golden scripts, `upstream-edge-golden.py` and `upstream-judge-golden.py`, all E501 and RUF001 on upstream's test strings, which they hold byte for byte; `pyproject.toml` exempts those two files from those rules and the judge's from formatting, and changes none of them. `make lint` exits 0.

**Consequence.** B11's Python files will be linted when that branch merges.
