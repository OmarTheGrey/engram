---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/helpers.ts
  - packages/adapters/test/letta/race.test.ts
supersedes: none
---

**What.** Tests relied on a global git identity; Linux CI has none: six Letta tests failed on PR 2's CI with "Author identity unknown".

**Why.** The tests' own git commits (a user's, another client's, a repository's first commit) ran with whatever identity the machine configured; this machine has one, the CI runner none. The adapter's commits were fine: it falls back to `Engram <engram@localhost>`. The race test's user loop also failed silently there, so it raced nothing.

**Result.** Every git call a test makes goes through `testGit`, which gives a fixed identity in its environment; the race test now requires at least one user commit. With no global or system git configuration (`GIT_CONFIG_GLOBAL` empty, `GIT_CONFIG_NOSYSTEM=1`) the old helper fails seven tests here and the new one none, and the adapters (384), CLI (178) and runner (100) tests all pass.

**Consequence.** Tests that commit name their own identity.
