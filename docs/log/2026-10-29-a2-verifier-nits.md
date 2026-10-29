---
date: 2026-10-29
author: claude-agent
type: change
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/letta/index.ts
  - packages/adapters/test/letta/repository.test.ts
  - packages/adapters/test/letta/race.test.ts
  - docs/decisions/0028-letta-adapter-over-memfs.md
supersedes: none
---

**What.** The verifier's three notes on the PR #20 fix pass: ADR 0028 now names `git commit -a`, `-am` and `git add -A` as clients that do commit an intent-to-add item (N1); the race test allows at most one reverted item per run, and only one whose deleting user commit has the adding Engram commit as its parent (N2); a commit refused by git's ref compare-and-swap is retried like an `index.lock` refusal (N3).

**Why.** N1 overstated a guarantee; N2 let a defect pass as git's race; N3 refused writes that would have succeeded.

**Result.** The verifier's N2 mutation (each item unstaged after its commit) now fails the race test 3 of 3 runs; the unmutated test passed 6 of 6. Two N3 tests, each red under its mutation.

**Consequence.** The branch was rebased onto main at fa41e29 (B3) without conflicts.
