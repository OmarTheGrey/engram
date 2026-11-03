---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
supersedes: none
---

**What.** A table config with `sensitivity` but no `gatemem_primary` silently gave no sensitivity table (P4V-5).

**Why.** The sensitivity table was built inside the branch for a primary set, and the other branch returned early.

**Result.** The table now raises (`2026-11-03-pr4-f2-sensitivity-guard`).

**Consequence.** A config entry the code cannot honour is refused, not ignored.
