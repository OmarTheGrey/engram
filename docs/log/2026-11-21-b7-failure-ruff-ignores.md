---
date: 2026-11-21
author: claude-agent
type: failure
card: B7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - pyproject.toml
supersedes: none
---

**What.** The first per-file ignores for the golden scripts named one rule each, and ruff still failed with 24 findings.

**Why.** Both scripts have both kinds, long lines and no-break spaces; I had read the counts per file wrong.

**Result.** Both files take E501 and RUF001; `ruff check research packages/bench/scripts` passes.

**Consequence.** None.
