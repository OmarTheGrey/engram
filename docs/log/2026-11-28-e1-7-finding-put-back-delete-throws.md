---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.7
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** A put-back that stops after writing the item back (a crash, its next round's delete failing, which is not caught and throws the offboarding out before its report, or the fourth round's give-up) leaves the erased item's content in the store, unrecorded.

**Why.** Found while writing the fix; the review showed the model reaches it too.

**Result.** In the code that leftover always follows a third erasure that found no record at the ref (the sweep had deleted it), so adoption refuses it (`engram/adopt/erased`) and never projects or serves it, but does not purge it, and a later sweep keeps it (E18-F7's rule). `erasure-gaps.test.ts` ("known limit") pins this on SQLite and Postgres; `putBackCrashReplayTest` shows the model purging where the code refuses.

**Consequence.** Residue card X19 measures; a later card can record a put-back failure as a swept deny instead of throwing.
