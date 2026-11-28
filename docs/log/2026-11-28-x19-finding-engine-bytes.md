---
date: 2026-11-28
author: claude-agent
type: finding
card: X19
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - research/results/h3-erasure-residue.json
supersedes: none
---

**What.** Erasure by redaction leaves most erased canaries in the bytes the engines keep: SQLite's free pages and WAL, Postgres's dead tuples and WAL, Mem0's SQLite vector file.

**Why.** The plane rewrites event bodies with UPDATE and deletes store records through the adapter; neither SQLite (secure_delete off) nor Postgres zeroes the old bytes, nor does Mem0's SQLite.

**Result.** Unreclaimed residue (bytes no live row holds): SQLite file 139 to 141 and WAL 98 to 112 of 200; Postgres heap 153 to 155, WAL 158; Mem0's files 137. The live tiers hold none of these.

**Consequence.** For card E9.13: crypto-shredding is measured by the same check, and should make these bytes unreadable; a later card could add secure_delete or VACUUM at offboarding. Not fixed here.
