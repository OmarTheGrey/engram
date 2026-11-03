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
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
  - packages/runner/src/mem-inv-probe.ts
supersedes: none
---

**What.** v1 promises, after ADR 0029, to report whether MEM-INV-Bench sessions read memory before acting; the table reported nothing of it (V-2).

**Why.** The rows carry what memory_read returned (`read`), but no step carried it into the sessions or the table.

**Result.** Each MEM-INV-Bench session records `read_before_action` and each rate gives its count and share (`2026-11-03-pr4-f2-read-before-action`).

**Consequence.** Same lesson as V-1: every reported quantity v1 names needs a field in the table.
