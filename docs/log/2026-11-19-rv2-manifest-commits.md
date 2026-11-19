---
date: 2026-11-19
author: claude-agent
type: change
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "uv run python four_rows.py (reproduce.check_row on the four rows, at this branch's code): repro: 4 of 4 reproduce"
  - "git merge-base --is-ancestor <cell> main: 2c503aa, 9a0d185, bc3f2e4, c89bdf8, f1f07f4 all on main"
supersedes: none
---

**What.** The four cells now read: h3-fault-set `f1f07f4`, h3-lint-floor `bc3f2e4`, and both h2 rows `c89bdf8`. No sha256 changed.

**Why.** RV-EXP-9 and decision sheet item 17: a row names the squash commit on main that holds its code.

**Result.** Every cell is an ancestor of main. Each row's script and config are byte-identical at its commit and on main (`git diff --quiet <commit> main -- <script> <config>`). Rerun through `reproduce.check_row` on this branch's code, all four reproduce their recorded hashes: a274701d, 354da571, 41294115, 529b1450. h3-fault-set differs from the finding's `3791779` (`docs/log/2026-11-19-rv2-decision-fault-set-commit.md`).

**Consequence.** `make test-repro` is unchanged, since it compares hashes, not cells.
