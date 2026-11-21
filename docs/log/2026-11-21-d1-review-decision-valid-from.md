---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/runner/src/recorder.ts
  - packages/runner/test/recorder.test.ts
supersedes: docs/log/2026-11-21-d1-decision-item-frame.md
---

**What.** Following the lead's decision in the review, an episode item is valid from the time it is recorded, not from the session's start. The session's own start and end are the episode's `started_at` (the header time) and `ended_at` (the last entry's time). Confidence 1, no ttl, no grants and status active stand as before.

**Why.** The item is "this session, as recorded now", so retention runs from when the plane learned it. The review showed that a session older than medium's 90-day episodic ttl was stored and then unreadable at once.

**Result.** The test "a session older than the episodic ttl is stored and read back" records at 2027-03-01 a session started on 2026-10-01 and reads it back. Restoring the old valid time fails it.

**Consequence.** A reader of when the work happened uses `started_at`, not `valid_from`.
