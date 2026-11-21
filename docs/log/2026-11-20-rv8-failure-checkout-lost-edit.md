---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/frontier_axes.py
supersedes: none
---

**What.** Restoring a mutated file with `git checkout` threw away its uncommitted fix along with the mutation.

**Why.** The mutation check of the clock comparison ran on a file with the fix not yet committed.

**Result.** The fixed file was restored from the copy taken before the mutation; the diff was checked, and the frontier tests pass (7).

**Consequence.** Mutation checks restore from a copy, never from git, unless the file is committed.
