---
date: 2026-11-22
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/scripts/skill-spec-golden.py
  - "uv run ruff check packages/core/scripts/skill-spec-golden.py"
supersedes: none
---

**What.** The first commit of the validator's golden script failed ruff with E501, a line of 104 characters against the limit of 100.

**Why.** An argument's help string ran long, and ruff was run only after the commit.

**Result.** Commit `0e28304b` shortened the help string. `ruff check` and `ruff format --check` pass on the file.

**Consequence.** None. ruff is run before each commit of a Python file.
