---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/race.test.ts
supersedes: none
---

**What.** The first runs of the new race test failed twice for reasons other than R2-1: once an intent-to-add entry stayed in the index after a refused write, and once the user's commit deleted an item Engram had just committed.

**Why.** The first: the restore's reset met the user's `index.lock` and failed (now reported, R2-3). The second is git's own race (see the finding on it).

**Result.** Git calls refused for `index.lock` are now retried for about two seconds before they count as failures; the test tolerates exactly the second case, naming it, and asserted ten passes in ten runs afterwards; the R2-1 mutation still fails it.

**Consequence.** The residual race is documented, not hidden.
