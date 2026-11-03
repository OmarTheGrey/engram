---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** `make h1-table GATE_BY_ACTION=1` without `READINGS=` rewrote `.engram/runs/h1-unread.json` and its key, harmless only because both table configs share a seed (F-8).

**Why.** The recipe skipped `--unread-out` only for `READINGS=`, not for the second reading.

**Result.** The gate-by-action run writes no template, and `make -n h1-table GATE_BY_ACTION=1` shows no `--unread-out` in a test. The mutant that writes it again is killed.

**Consequence.** A second reading never writes the first reading's files, whether or not their content would match.
