---
date: 2026-11-28
author: claude-agent
type: finding
card: E8.16
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** A write or a check under an erased item's id is refused, for anyone, with the reason a held id gets but under the rule id engram/write/erased: the answer tells a non-member that the id was an offboarded person's item.

**Why.** The independent review of the branch found it; the first oracle test paired one actor with one id and compared reasons only.

**Result.** Pinned in `EXPECTED_ORACLES` of the HTTP suite for every probe actor, write and checkWrite: `200 deny engram/write/erased` against `200 allow preset.medium/write/person`; the other held ids answer engram/write/membership.

**Consequence.** The fourth existence oracle RD1 leaves. Not fixed here (the card's risk); the fix, answering a non-member with the membership rule id, belongs to a later card.
