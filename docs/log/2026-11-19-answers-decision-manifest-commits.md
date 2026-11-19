---
date: 2026-11-19
author: claude-agent
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/scripts/reproduce.py
  - docs/log/2026-11-03-orch-manifest-commit-after-squash.md
supersedes: none
---

**What.** Six MANIFEST rows name `2c503aa` (#41) and two name PR 4's squash commit `9a0d185` (#27), not all eight `9a0d185` as planned.

**Why.** `9a0d185` is on main and holds every row's script, but the TypeScript entry points of the reach, admission, C4 agreement, C4 walk, cost and refusal-leak rows import core, bench and runner modules that later commits changed (#29, #33, #28, #32, #38, #36, #37, #41; the last is `2c503aa`). The two H4 rows run Python only, unchanged since `9a0d185`.

**Result.** Reran the six rows with `research/scripts/reproduce.py`'s own `check_row` on main's code: each regenerated its committed sha256 (gatemem-reach in 383 seconds, the rest under 30). No sha256 moved.

**Consequence.** Each row names the latest main commit holding the code that reproduces it.
