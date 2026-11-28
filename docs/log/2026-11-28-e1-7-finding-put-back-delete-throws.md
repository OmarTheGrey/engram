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

**What.** The put-back's new delete, like its write before, is not caught: a transient store failure there throws out of the offboarding before its report.

**Why.** Found while writing the fix; the put-back's write already behaved so.

**Result.** The scope stays frozen until offboarding runs again, which completes it (the begin mark's rule); nothing erased is left unrecorded by it.

**Consequence.** For a later card: record a put-back failure as a swept deny instead of throwing.
