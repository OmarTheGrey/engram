---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "ENGRAM_STATEFUL_STRICT=F6 ENGRAM_STATEFUL_RUNS=2000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** Finding E14-F6: after the owner's crashed rewrite or grant change of a role item carrying grants, a co-holder's adoption of the role denies the record and retires the owner's committed item for good.

**Why.** The reworked model's first default run (seed -19116893, path 179:2:1:4:4:4:4, replay path JACACAa:VB): Lee grants Sam his role item, his rewrite of it is killed after its store write, and Dana adopts the role.

**Result.** Dana's adoption is refused under `engram/grant/owner` (only the owner rewrites an item carrying grants) and adoption retracts Lee's item; Lee's own adoption afterwards changes nothing. Sam loses the read; the store keeps bytes the log denied. Strict runs also reach it through a killed grant removal (path 43:3:3:3:9:8:12:12:12) and through an item evicted before the adoption (path 1794:4:2:3:4:8:1:3:5:5:9:10:10:10:10). Pinned in the test named E14-F6.

**Consequence.** For the lead: recovery of a shared scope depends on who adopts it.
