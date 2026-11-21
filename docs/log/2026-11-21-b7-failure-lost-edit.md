---
date: 2026-11-21
author: claude-agent
type: failure
card: B7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/merit/env.ts
supersedes: none
---

**What.** A mutation check's restore, `git checkout packages/bench/src/merit/env.ts`, threw away the uncommitted B7-8 edit to that file along with the mutation.

**Why.** The edit was not committed before the mutation, so the checkout went back to the last commit.

**Result.** The edit was written again from a fragment file and committed; its tests pass. The mutation result (removing the pin fails 2 tests) was taken on the same logic.

**Consequence.** Commit before a mutation check, then restore with checkout.
