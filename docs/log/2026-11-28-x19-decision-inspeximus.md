---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/absorbed.md
  - research/scripts/h3_erasure_residue.py
supersedes: none
---

**What.** From inspeximus `inspeximus/erasure_residue.py` (MIT, `DanceNitra/inspeximus` at 41a83029aa46, licence read at the commit) the check ports its split of a byte hit into a live copy and unreclaimed bytes, and its statement of the matching scope (a literal, case-sensitive match); no code is copied.

**Why.** The card names it as a port of the scan. Its scan reads SQLite rows and files in Python; here the live tiers come from core over the Db and the Adapter, so only the outcome split and the stated scope carry over.

**Result.** `residue_unreclaimed` per byte tier; one limit states the matching scope; one row in docs/absorbed.md, no NOTICE, as for a port.

**Consequence.** None.
