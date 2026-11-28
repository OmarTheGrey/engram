---
date: 2026-11-28
author: claude-agent
type: measurement
card: X19
chapter: results
pillar: twin
hypothesis: none
evidence:
  - research/results/h3-erasure-residue.json
  - research/configs/h3-erasure-residue.json
  - research/results/MANIFEST.md
  - uv run python research/scripts/h3_erasure_residue.py --config research/configs/h3-erasure-residue.json --out research/results/h3-erasure-residue.json
supersedes: none
---

**What.** Card X19's engineering check of proposal U7 (not a hypothesis result): 20 person scopes under twin, 200 exposed and 200 never-exposed canaries, two backends, four stores. MANIFEST sha256 `a83e3187...24f5`, commit ef27c33b; two runs identical.

**Why.** Rule 9. Twin's offboarding claim had no measurement; U7 is not yet registered.

**Result.** Before offboarding every exposed canary is in the projection, the events and the store (200 of 200). After, the live tiers hold 2 of 200 in every run: the record a store refuses to delete and the moved record; 40 are retained by decision (20 promoted, 20 at a shared ref). The bytes hold most of the rest: SQLite's file 141 to 143 and WAL 100 to 112, Postgres's heap 155 to 157 and WAL 160, Mem0's files 139, Letta's git objects 160. Never-exposed canaries found: 0 of 200 everywhere.

**Consequence.** Register regenerated; findings for card E9.13.
