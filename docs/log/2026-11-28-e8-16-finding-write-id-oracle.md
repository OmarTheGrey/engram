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
supersedes: none
---

**What.** A write or a check under the id of an item the writer cannot access is refused with `the item id is held by an item you cannot access` (engram/write/membership), while a never-held id is written: the answer tells whether an id exists.

**Why.** Card E8.16 asks that a denied id and a missing id answer alike; RD1 leaves this.

**Result.** Pinned in `ORACLES.write` and `ORACLES.checkWrite` of the HTTP suite; it cannot answer alike while ids are unique across scopes, and the asker must already hold a UUIDv7 to ask.

**Consequence.** Pinned and logged, not fixed here (the card's risk). Closing it needs a design choice about id uniqueness for the lead or a later card.
