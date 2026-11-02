---
date: 2026-11-03
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-02-x1r3-failure-mutation-restore-lost-work.md
supersedes: docs/log/2026-11-02-x1r3-failure-mutation-restore-lost-work.md
---

**What.** The round-3 mutation script of PR #25 restored each mutated file with `git checkout`, which also discarded the uncommitted C4 walk in `conditions.ts` and `retrieve.ts`.

**Why.** The work under test was not committed before mutating it, and `git checkout` restores the last commit, not the file as it stood before the mutation. The superseded entry gave no lesson (PR 3 verifier, N-4).

**Result.** Both edits were applied again and the tests and the C4 length script gave identical output. The lesson: commit the work before mutating it, and restore a mutated file by copying back the saved original, never with `git checkout`. This PR's mutation checks follow it: each run saves the file, mutates it, runs the test and copies the original back, after the work is committed.

**Consequence.** Mutation checks in this repository commit first and restore by copy.
