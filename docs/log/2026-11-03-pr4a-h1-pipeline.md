---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/scripts/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
  - research/tests/test_h1_pipeline.py
  - research/configs/h1-table.json
  - "make h1-table"
supersedes: none
---

**What.** H1's pipeline runs end to end offline: a converter from a run's `results.jsonl` to `h1-sessions/1`, and `make h1-table`, which converts both live arms and builds the table with `research/scripts/h1_table.py`.

**Why.** PR 2's table read a schema no runner output had.

**Result.** `test_h1_pipeline.py` replays `research/configs/x1-h1-probe.json` from its cassettes (0 new calls), converts 20 sessions (GateMem 8, its C1 and utility rows left out; MEM-INV-Bench 12, the benign case left out) and builds a table: every C4 minus C5 contrast degenerate at 0, decision "not supported", scripted replies, not results. A second test holds the Makefile recipe, `research/configs/h1-table.json` and both H1 configs to one model slot, store and run folder. Mutants falling back to the rule on a missing verdict, mislabelling C2's preset, or keeping excluded replies are killed.

**Consequence.** The live run: `make run` per arm with `MODEL=` and `LIVE=1`, then `make h1-table`.
