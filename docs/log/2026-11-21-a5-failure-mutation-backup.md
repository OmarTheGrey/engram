---
date: 2026-11-21
author: claude-agent
type: failure
card: A5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/validity.ts
supersedes: none
---

**What.** After the mutation check on the validity double, the command meant to restore the file failed: the file was not yet tracked, so `git checkout` could not restore it, and the fallback copied from a backup path that had never been written.

**Why.** The backup went to the first of two paths, and the restore read the second.

**Result.** The file was restored from the backup that did exist, and checked (the mutated line gone, the original `windows.set` back) before anything was committed; the mutation itself did its job, failing the meta-test on the window case.

**Consequence.** Mutation checks on untracked files back up to one named path and restore from it.
