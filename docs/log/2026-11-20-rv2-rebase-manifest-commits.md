---
date: 2026-11-20
author: claude-agent
type: change
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "reproduce.check_row under NODE_V8_COVERAGE on the branch rebased onto 00c606e, ten non-H4 rows: all reproduce"
  - "git diff --name-only 07828fc origin/main -- research/analysis, the H4 scripts and configs, results_io.py, pyproject.toml, uv.lock: empty"
supersedes: docs/log/2026-11-19-rv2-review-manifest-commits.md
---

**What.** After rebasing onto `00c606e` (RV3, RV1, E2.6), the cells follow the same rule. No sha256 changed.
- `00c606e`: h1-gatemem-reach, h1-mem-inv-admission, h3-fault-set, h3-lint-floor, h2-longmemeval-ttl. Their runs call E2.6's `commit.ts`, `write.ts`, `retention.ts` or `lint.ts`.
- `755c29d`: h1-c4-walk, h1-c4-verdict-agreement, h1-cost, h2-longmemeval-cost. Their runs call RV1's `sequentialIds` (its text changed; its default output did not) or `run.ts`.
- Unchanged: h1-refusal-leaks `2c503aa` (no changed function called) and both H4 rows `9a0d185`.

**Why.** The rule from `docs/log/2026-11-19-rv2-review-decision-commit-rule.md`.

**Result.** Each changed function's line range overlaps one the run called. In the files these rows load, the merges' other changed lines are new constants used only by uncalled functions (checked by hand).

**Consequence.** Every cell is on main.
