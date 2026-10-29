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

**What.** Three mutations of the Letta adapter survived its tests: the pathspec dropped from `git commit`, `--force` dropped from `git add`, and the per-command `core.safecrlf=false` removed (review finding R2-6).

**Why.** No test staged a user's file, ignored `engram/`, or set `core.safecrlf=true` (this machine's system config sets only `core.autocrlf=true`, and Linux CI sets neither).

**Result.** Four tests now cover them: a user's staged file stays staged and out of Engram's commit, `engram/` in `.gitignore`, `core.autocrlf` and `core.safecrlf` true in the repository's own config, and a broken commit signer refusing the open cleanly. Each of the three mutations fails its test; removing the setup's cleanup fails the signer test.

**Consequence.** None beyond the tests.
