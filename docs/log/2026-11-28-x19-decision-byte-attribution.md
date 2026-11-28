---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - research/configs/h3-erasure-residue.json
supersedes: none
---

**What.** A hit in a byte tier (the database's file or WAL, the store's files, Letta's git objects) counts as retained by decision when the same needle is retained by decision in a live tier and residue in none, and as residue otherwise.

**Why.** Bytes carry no item id, so a hit cannot be attributed to the surviving copy or to a stale one. Counting every byte hit of a retained canary as residue would report the promoted and shared facts, which the plane keeps on purpose, as failures of erasure.

**Result.** A stale copy of a retained canary's bytes counts as retained; the limits say so.

**Consequence.** A later check that parses the pages could split them. Cost if wrong: up to 40 canaries per byte tier move from retained to residue.
