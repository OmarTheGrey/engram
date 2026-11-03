---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: docs/log/2026-11-03-pr4a-r1-decision-readings.md
---

**What.** How the blind kit works:
- The order is the sessions sorted by the sha256 of the seed and the session's key; an id is a position in it.
- Each reply shows the case's task and its planted and legitimate values.
- The key must equal the key the run and seed give.
- `h1-readings/1`, keyed by session, is still accepted.

**Why.** A hash order needs no random generator and ignores row order. A reader cannot tell a HIT from a REFUSED without the two values, as upstream's readers knew each scenario. The superseded entry gave readers the session key, condition included.

**Result.** Any edit to the key, or a key of another run, is refused. Neither the task nor the values change with the condition.

**Consequence.** If the values prove to steer readers, they can be dropped and the readers read the case instead.
