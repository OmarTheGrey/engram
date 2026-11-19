---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/rv1.test.ts
supersedes: none
---

**What.** The turn limit is recorded in the config and in the run's fingerprint (`run.json`), and not in any cache key; the review's fix had named the cache key too.

**Why.** No call's request depends on the limit: a call within it sends the same transcript whatever the limit, and the call past it is never made, so nothing is recorded for it. Keying on it would make every existing cassette miss once a limit is set, and a changed limit would pay again for calls already made. Rule 7's key is unchanged.

**Result.** A config with no limit keeps its old keys; RN1's fixture with a limit of 8 replays its committed cassettes with zero new calls; a capped run's replay caps at the same call, since hits count as calls.

**Consequence.** Raising the limit replays the first calls and pays only for the new ones.
