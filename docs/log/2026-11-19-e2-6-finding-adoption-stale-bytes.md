---
date: 2026-11-19
author: claude-agent
type: finding
card: E2.6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** An adoption can still record a stale writer's store write as the owner's import, if its listing catches those bytes before the writer puts the store back and it commits before the writer's deny.

**Why.** Adoption cannot tell a write in flight from an owner's hand edit without an intent recorded before each store write.

**Result.** It needs a committed change, a stale write of the same item and an adoption across two handles; it re-records only what the owner's own call wrote, and never an erased item. The two-handle walk did not find it in 8300 runs, since the end state stays consistent.

**Consequence.** A backlog row; an intent event per write would close it at one more event per write.
