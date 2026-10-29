---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/letta/git.ts
  - packages/adapters/test/letta/repository.test.ts
supersedes: none
---

**What.** An inherited git environment redirected the Letta adapter's git calls: with `GIT_INDEX_FILE` set, a write staged into a foreign index (review finding R2-4).

**Why.** `runGit` passed `process.env` through unchanged, and git exports such variables to hooks.

**Result.** `runGit` removes nine variables (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_NAMESPACE`, `GIT_PREFIX`, `GIT_CEILING_DIRECTORIES`). A test per variable writes with it set and checks a clean status and an untouched foreign repository; without the stripping five of the nine fail (the other four do no harm in that setup).

**Consequence.** None beyond the fix.
