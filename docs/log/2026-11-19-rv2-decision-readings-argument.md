---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/h1-sessions.ts
  - Makefile
supersedes: none
---

**What.** `READINGS=a.json,b.json` reaches the converter as one argument, `--readings a.json,b.json`, which the converter splits on commas. It is not repeated `--readings` options.

**Why.** The Makefile passes `$(READINGS)` unchanged, as it did before, so the make target needs no comma-to-option rewriting. Each named file is still checked against `--unread-out`, so a reading is never overwritten by the template.

**Result.** `make -n h1-table READINGS=ana.json,ben.json` shows `--readings "ana.json,ben.json"` (`research/tests/test_h1_pipeline.py`).

**Consequence.** A readings path cannot contain a comma. The files live under `.engram/runs/` by design, so this costs nothing in practice.
