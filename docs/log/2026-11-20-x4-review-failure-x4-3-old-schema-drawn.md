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

**What.** Review finding X4-3 on PR #57: the figure drew an `h1-table/2` table and silently left out the effect line.

**Why.** `render` read `effect` with `get` and drew nothing when it was absent, rather than checking the schema.

**Result.** `render` refuses any schema but `h1-table/3`; a test passes an `h1-table/2` table and expects the refusal.

**Consequence.** A table built before the effect sizes must be rebuilt before it is drawn.
