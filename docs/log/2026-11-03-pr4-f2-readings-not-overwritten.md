---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - packages/runner/scripts/h1-sessions.ts
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** `make h1-table READINGS=` writes no template. The converter refuses `--readings` and `--unread-out` naming the same file.

**Why.** P4V-4.

**Result.** A CLI test passes the same file under two spellings: refused, readings intact. A `make -n` test shows no `--unread-out` with `READINGS`. The mutant dropping the refusal is killed.

**Consequence.** Readers' filled copies are safe from a rerun.
