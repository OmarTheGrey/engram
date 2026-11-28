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
  - docs/log/2026-11-28-e1-7-finding-put-back-delete-throws.md
supersedes: none
---

**What.** The two store paths card E1.7 names leave their record in the store on every backend and store: the record a store refuses to delete (left_in_store) and the record under an erased id after an erasure that found none at its ref (not_found_in_store, F7's rule).

**Why.** Both are reported in the deletion report and refused by adoption, so never served, but the bytes stay; the log keeps their merging hashes by decision.

**Result.** store-records residue 2 of 200 in all eight runs, by role left-in-store 1 and not-found 1; their hashes counted as erased-content-hash, never as residue.

**Consequence.** For E9.13 and a later erasure card: a purge after a refused delete or at a moved store's new location would bring the live residue to 0.
