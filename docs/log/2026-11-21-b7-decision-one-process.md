---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/scripts/merit-shim.py
supersedes: none
---

**What.** One MERIT process runs every cell, calling run_pilot.py's `main` once per cell.

**Why.** Importing LiteLLM takes about 13 seconds on this machine; seven processes would take over a minute before any call.

**Result.** A replay of the slice takes about 40 seconds, record included (`time` on the record run: 39.4 s).

**Consequence.** None.
