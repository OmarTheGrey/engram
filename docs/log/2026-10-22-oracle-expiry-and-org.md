---
date: 2026-10-22
author: claude-agent
type: decision
card: S0.9
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/oracle.ts
  - packages/core/test/unit/oracle.test.ts
supersedes: none
---

**What.** The invariant oracles moved out of the lead-owned invariants file into `test/property/oracle.ts`, which carries the same ownership, and grant expiry is now compared as instants rather than as strings.

**Why.** The final step-0 review (an Opus reviewer, the second reviewer the convention requires) found that `"...00.5Z" < "...00Z"` as strings, so a live grant read as expired. Moving the oracles lets a unit test pin them down.

**Result.** The unit test failed on the string comparison and passes on instants; invariants 3 and 4 pass and 1 and 2 still fail as designed.

**Consequence.** The oracle file states the one commitment awaiting the lead: an `org` item is readable through scope only with an explicit "org" membership.
