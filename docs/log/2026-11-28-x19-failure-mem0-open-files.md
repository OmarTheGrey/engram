---
date: 2026-11-28
author: claude-agent
type: failure
card: X19
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/erasure-residue.ts
  - research/scripts/h3_erasure_residue.py
supersedes: none
---

**What.** The first full run failed on SQLite and Mem0: node exited 1 with `EBUSY` from `rm` when removing its temporary folder.

**Why.** Mem0's vector store opens its SQLite files with better-sqlite3 and has no close, and Windows will not delete an open file.

**Result.** The script takes `--work <dir>`; the research script makes that folder inside its own temporary folder and removes it after node exits.

**Consequence.** The tests' runs, which never open Mem0, still remove their own folder.
