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
  - "pnpm --filter adapters exec vitest run test/conformance test/letta test/plane"
supersedes: none
---

**What.** The review fix pass of PR #20 resolved findings R2-1 to R2-13 on the Letta adapter, doctor's letta check and ADR 0028.

**Why.** The review found two critical defects (a write reported stored that the user's commit swallowed; a commit onto a rebase's detached HEAD), five more defects, three surviving mutations and four documentation gaps.

**Result.** Commits now stage new files intent-to-add and use `git commit --only`, decide "already stored" against `HEAD:<path>` before staging, and fail on every git failure; commits are refused in six repository states; the restore checks its reset; nine redirecting git variables are stripped; nested repositories are refused; the Letta lock is stale after 300 s. Eleven mutations, one per fix, each turned its test red.

**Consequence.** ADR 0028's amendments are corrected; the residual git race is stated there.
