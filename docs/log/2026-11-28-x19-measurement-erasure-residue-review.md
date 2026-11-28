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
supersedes: docs/log/2026-11-28-x19-measurement-erasure-residue.md
---

**What.** Card X19's result regenerated after review. Retained means only promoted, shared ref, kept hash or surviving hash; kept canaries are indeterminate in the bytes; byte rates are over the 160 countable canaries. An engineering check, not a hypothesis result. MANIFEST sha256 `45b037c2...8426`, commit 47a18a34.

**Why.** Rule 9; U7 is not yet registered.

**Result.** The live tiers hold 2 of 200 in all eight runs, E1.7's two records, and 40 are retained (20 promoted, 20 at a shared ref). Byte residue of the 160 countable canaries: SQLite file 141 to 143, WAL 102 to 112; Postgres heap 155 to 157 (an upper bound, autovacuum off), WAL 160, every countable canary; Mem0's files 139; Letta's git objects 160. Never-exposed: 0 of 200 everywhere.

**Consequence.** Register and page rebuilt.
