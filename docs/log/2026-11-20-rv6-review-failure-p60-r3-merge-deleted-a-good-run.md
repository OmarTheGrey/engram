---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** A merge that failed to take a shard lock deleted the files of a good run already in the output folder (verifier finding P60-R3).

**Why.** close() removed an unsealed merge's files whenever the journal was a merge, even before the merge had written anything.

**Result.** A flag set when the merge starts writing the folder now gates the cleanup. Test: a good run in the folder survives a merge refused by a shard lock of another host. Mutation: gating on sealed again fails it.

**Consequence.** A refused lock leaves the folder as it was.
