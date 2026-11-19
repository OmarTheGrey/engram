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
  - "reproduce.check_row under NODE_V8_COVERAGE, ten non-H4 rows: all reproduce"
  - "git log 9a0d185..main -- research/analysis research/scripts/results_io.py, H4 scripts and configs, uv.lock: empty"
supersedes: docs/log/2026-11-19-rv2-manifest-commits.md
---

**What.** All twelve cells now follow the rule. No sha256 changed.
- `f1f07f4`: h1-gatemem-reach, h1-mem-inv-admission, h3-fault-set. Their runs call `evaluateWrite`, which E9.4 rewrote.
- `c89bdf8`: h1-cost (`cost-shapes.ts` `main`, `countConfig`) and both h2 rows.
- `bc3f2e4`: h3-lint-floor.
- `2c503aa`, unchanged:
  - h1-c4-walk and h1-c4-verdict-agreement, which call only read functions in `evaluate.ts` that later commits never touched, and nothing in `plane.ts` or `write.ts`;
  - h1-refusal-leaks, whose one later-changed file runs only at load.
- `9a0d185`: both H4 rows, unchanged.

**Why.** RV-EXP-9, then RV2-2.

**Result.** Every cell is an ancestor of main, and every non-H4 row reproduces on this branch's code. The H4 rows took more than fifteen minutes and were not rerun; their inputs are unchanged since their cell.

**Consequence.** RV1's merge must be checked under the same rule after the rebase.
