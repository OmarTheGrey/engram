---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_figure.py
  - research/tests/test_h1_figure.py
supersedes: none
---

**What.** Review finding X4-1 on PR #57: `h1_figure.py` wrote a planted table's figure to `research/results/h1-figure.svg`, exit 0, captioned "H1: supported".

**Why.** The rule that no fixture figure enters `research/results/` was in the docstring only; nothing in `main` enforced it.

**Result.** `check_destination` refuses an output under `research/results/` unless the table is `research/results/h1-table.json`, both paths resolved through `..` and symlinks, before anything is written. Two tests, one through `main` with a temporary table and two spellings of the path. Mutants that skip the call or leave the output unresolved fail. The first red run wrote a stray file there, removed by hand, so the test now deletes it in a `finally`.

**Consequence.** Only the committed table can produce the committed figure.
