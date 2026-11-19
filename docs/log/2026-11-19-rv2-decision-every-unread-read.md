---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** `memInvSessions` now refuses readings that leave an UNREAD attack session of the run unread. This covers a readings file keyed by session (`h1-readings/1`) as well as the blind join. It applies only when readings are given. With none, UNREAD sessions stay excluded, as they do before the members read.

**Why.** The finding names the blind join's missing check, but a partial `h1-readings/1` file left the same hole. Item 14 says a missing verdict is refused on whichever path the readings arrive.

**Result.** The vitest case "readings that leave an UNREAD session of the run unread are refused" passes, and fails with the check removed. The pipeline test's direct file now reads both UNREAD sessions.

**Consequence.** If wrong, an adjudication covering only some sessions must first be completed. The `h1-readings/1` path is kept, both readers in one file, as the non-blind route for recorded readings.
