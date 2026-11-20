---
date: 2026-11-20
author: claude-agent
type: change
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/plane/read.ts
  - packages/core/src/plane/adopt.ts
  - packages/core/src/events.ts
supersedes: none
---

**What.** Review fix pass 2 of PR #58: findings N-1, N-2 and N-3 fixed, invariant 6 strengthened; N-4 left as a known cost, as the verifier asked.

**Why.** The verification of the first pass found a search leak opened by I-3, a kind floor that did not survive two adoptions, and an erased id refused forever after a move back.

**Result.** Three new tests in `rv4-review.test.ts` (P30b, P4b, P32 against P33), and the I-1 test now expects an edited erased id to adopt. Mutations: N-1 hit check off, N-2 floor from this adoption only, N-3 not-found exclusion restored, and the floor deleted in `adoptedItem`. Each fails its test; the last two also fail invariant 6.

**Consequence.** None beyond the findings.
