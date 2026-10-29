---
date: 2026-10-29
author: claude-agent
type: finding
card: A2
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/race.test.ts
  - docs/decisions/0028-letta-adapter-over-memfs.md
supersedes: none
---

**What.** Two git clients committing in one working tree can revert each other: a plain `git commit` reads HEAD, then the index file, and an Engram commit landing between the two (ref updated, index not yet renamed into place) is reverted by the other client's commit.

**Why.** Found while making the R2-1 race test deterministic: one run showed a user commit, parent Engram's commit, deleting the item Engram had just added.

**Result.** About one run in fifteen of sixteen writes against a tight commit loop (`race.test.ts`); git's ref compare-and-swap protects Engram's commits (seen as "cannot lock ref 'HEAD'" refusals), not the other client's. No adapter-side step closes it.

**Consequence.** ADR 0028 states it; a Letta agent and Engram writing one checkout at once is a limitation for the thesis.
