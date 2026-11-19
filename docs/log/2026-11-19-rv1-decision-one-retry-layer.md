---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/conditions.ts
  - packages/runner/src/model/retry.ts
supersedes: none
---

**What.** The answer path retries a transient failure once per call inside the session's cassette model, with the benchmark client's policy (GateMem's router for GateMem and LongMemEval, MEM-INV-Bench's driver for MEM-INV-Bench), and pi's own auto-retry is turned off in every condition's session.

**Why.** Two retry layers would multiply attempts (three of ours inside each of pi's three), and pi's waits run on real timers, which a test cannot inject. One layer keeps attempts and waits deterministic, as the judge and the note already do. LongMemEval's upstream client states no policy at its pin, so it takes GateMem's, the judge's.

**Result.** Only the final reply of a retried call is recorded, so no cache key moves; every fixture config replays with zero new calls.

**Consequence.** An error pi would retry and our policy does not (a status outside the list) now fails the session.
