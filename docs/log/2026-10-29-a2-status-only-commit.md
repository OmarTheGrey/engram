---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/commits.test.ts
  - "pnpm --filter adapters exec vitest run test/letta/commits.test.ts"
supersedes: none
---

**What.** The first version of the commit-count test failed: it required every commit to touch both the item file and `engram/MEMORY.md`.

**Why.** A status-only rewrite changes the item file alone, because the index line names the class, scope and version but not the status, so that commit touches one path. The test also compared an unsorted expectation with git's sorted file list.

**Result.** The test now requires each commit to touch the item file and nothing besides it and the index, and checks that the status-only rewrite touched the item file alone; it passes with 5 writes and 2 deletes giving 7 commits.

**Consequence.** "Touching only the item file and the index" means at most those two paths; ADR 0028's amendments say so.
