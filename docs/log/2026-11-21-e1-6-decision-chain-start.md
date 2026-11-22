---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
supersedes: none
---

**What.** The chain begins when a handle first keeps it, at the next seq, and the genesis is the backfill checkpoint; earlier events are not hashed after the fact.

**Why.** ADR 0038 decision 6 left open whether existing events are backfilled.

**Result.** Hashing old events at keep time would vouch for content nobody watched being written. The genesis records `start`, the verifier counts events before it as unchained and says nothing vouches for them.

**Consequence.** An existing log is chained from its next event on; a fresh CLI log from seq 0.
