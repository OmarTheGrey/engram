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

**What.** The Letta adapter reported writes as stored that were never committed by Engram (review finding R2-1, critical).

**Why.** A write staged its files with `git add`, so a user's `git commit` running at that moment committed them; Engram's commit then found nothing to commit, and the adapter counted that as success.

**Result.** Reproduced by the reviewer with two writer processes and a user commit loop (16 writes, 12 Engram commits, four user commits holding engram files). Fixed: new files are staged intent-to-add, which another client's commit never takes, the commit is `--only` on the two paths, and any commit failure is a failure. `race.test.ts` fails when the old staging and success rule are restored.

**Consequence.** Engram never stages an item's content where another client can commit it.
