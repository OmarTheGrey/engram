---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/residue.ts
  - packages/core/test/unit/residue.test.ts
supersedes: none
---

**What.** The scan, `findResidue` and `scanBytes`, lives in `packages/core/src/residue.ts`, exported from core; the workspace, the canaries and the byte sources stay in `packages/bench/src/residue/`.

**Why.** Card E9.14 (the signed erasure receipt with residue verification) must call it, and the orchestrator asked for a core function; the card's file list names only the bench folder. The scan is read-only, takes the Db and Adapter it is given, has no store-specific branch, reads no clock and draws no randomness. Calling a hit retained by decision reads the log's own rules (erase events, promotions, store refs): plane knowledge.

**Result.** Core gains one module and one export line; no existing module changes.

**Consequence.** E9.14 calls findResidue with a receipt's hashes. Cost if wrong: moving one file.
