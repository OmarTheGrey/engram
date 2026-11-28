---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.8
chapter: discussion
pillar: twin
hypothesis: none
evidence:
  - specs/replay.qnt
  - packages/core/test/model/trace-replay.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** E18-F4: a record whose purge adoption already decided is deleted again by a later adoption with no event and without the listing's deferral.

**Why.** Found in a sampled batch (seed 11); scenario `e18RepeatedPurgeTest` diverges at step 21.

**Result.** `adoptStoreItems`'s `decided` branch runs `purgeOutcome` before `adoptWrite`'s staleness check, so a listing older than a change still deletes. It widens the window of the known purge race (`sweptIdPurgeRaceTest`).

**Consequence.** For card E1.7, which moves the purge's check under the lock: apply it to the repeated purge too.
