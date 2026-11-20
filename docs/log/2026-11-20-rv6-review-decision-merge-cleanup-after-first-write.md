---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/journal.ts
supersedes: none
---

**What.** Closing a merge removes its files only once the merge has begun writing the folder.

**Why.** Taking the locks comes first and writes nothing; removing files then destroyed work that was not the merge's.

**Result.** One private flag, set where the merge clears the folder.

**Consequence.** A crash between the clearing and the seal still leaves nothing resumable, as P60-3 requires.
