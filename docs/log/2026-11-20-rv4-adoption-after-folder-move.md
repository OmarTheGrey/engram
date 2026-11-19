---
date: 2026-11-20
author: claude-agent
type: change
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/src/events.ts
  - packages/adapters/test/plane/rv4-files.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
supersedes: none
---

**What.** A moved files folder now adopts: a projected holder of the ref, in the same store and scope, that the listing no longer holds is retired (`engram/adopt/retract`) in the transaction that adopts the record now there.

**Why.** Backlog row "Adoption after a folder move": `refProblem` counted the retired and unlisted holders, so every adoption of a moved folder threw, with no recovery short of moving it back.

**Result.** Move test: `allowed: 4, retired: 4, unchanged: 1`, then a quiet second adoption; moving back restores the old ids the same way. An offboarded folder moved: 4 denials under `engram/adopt/erased`, nothing projected, an edited file adopts. An owner-retired file moved: refused under `engram/adopt/rekeyed` until edited. Mutants "no vacating", "no scope-wide erased check" and "no rekeyed refusal" each fail a test.

**Consequence.** ADR 0013's RV3 amendment and `docs/dogfood.md` no longer say the move fails closed.
