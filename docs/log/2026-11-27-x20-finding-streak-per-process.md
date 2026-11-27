---
date: 2026-11-27
author: claude-agent
type: finding
card: X20
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/answer-refusal.test.ts
  - packages/runner/README.md
supersedes: none
---

**What.** The five-item streak counts within one process. A resume starts it at zero, and each shard counts its own.

**Why.** The final review's finding 5. The count is module state in cassette.ts, and a resume skips the finished sessions without counting them. Two consequences were not written down before.

**Result.** A run-wide misread can cost up to four items per shard per resume before the stop. MERGE's byte-for-byte claim holds only when no streak in the unsharded run would have crossed a shard boundary. A new test pins the reset: after a streak stop, a resume replays the fifth item's recorded refusal, counts one, and goes on to the sixth item (2 new calls). The doc comment on `REFUSAL_STREAK_LIMIT`, the runner README and the H1 runbook say so.

**Consequence.** No code change. The operator reads a streak stop per shard.
