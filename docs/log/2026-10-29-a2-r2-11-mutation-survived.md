---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/repository.test.ts
supersedes: none
---

**What.** The first R2-11 test (delete an item file never committed) did not catch its own mutation: putting the never-committed path back into the pathspec left it green.

**Why.** With no index line for the stray file, HEAD already held every change, so the delete took the "already stored" path and never reached the pathspec.

**Result.** A second test commits the index line but not the file, so the delete must commit the index alone; it fails under the mutation and passes with the fix.

**Consequence.** Each R2 fix was mutation-checked against the test that names it.
