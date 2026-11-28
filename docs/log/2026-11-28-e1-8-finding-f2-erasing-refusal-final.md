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

**What.** E18-F2: a record refused while its scope was being erased (`engram/offboard/erasing`) is never adopted after the erasure completes while it holds the same bytes.

**Why.** Found by the replay: 3 of 200 traces; scenario `e18ErasingRefusalFinalTest` diverges at step 11.

**Result.** Adoption skips a record whose bytes the item's last write event denied (`adopt.ts`, "denied before with the same hash"), which treats a temporary refusal as final. The model adopts it; the code leaves a record in the store the plane never records.

**Consequence.** For the lead: exempt the erasing refusal from the same-hash skip, or state the behaviour in ADR 0010.
