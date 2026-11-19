---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/rv1.test.ts
supersedes: none
---

**What.** A runner config may set `turn_limit`, the most model calls one session may make: the call past it is never made, and the session is excluded under the reason `turn limit` from the run's summary and from H1's sessions (review finding RV-EXP-5).

**Why.** Nothing bounded a session's turns: a model that keeps reading adds unbounded paid calls.

**Result.** In `packages/runner/test/rv1.test.ts`, a faux model that never stops reading, at a limit of 3, makes three calls in each of two sessions, both excluded; the replay caps at the same call with zero new calls. RN1's fixture at a limit of 8 replays its committed cassettes with zero new calls and the same rows. In H1's sessions a capped session is excluded as `turn limit` (a null `utility_ok` for utility) and never goes to the readers.

**Consequence.** The value and the rule are the lead's (backlog row "Turn limit").
