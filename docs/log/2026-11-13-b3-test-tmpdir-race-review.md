---
date: 2026-11-13
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - packages/runner/src/stores.ts
  - "pnpm --filter runner exec vitest run test/b3.test.ts"
supersedes: none
---

**What.** A review of the B3 test's own temp folder found no defect to fix.

**Why.** CI on three later PRs failed only at the B3 leftover check, so the fix had to isolate that check fully and clean up on failure.

**Result.** `openStore` reads `tmpdir()` on every call and nothing else in the repository makes `engram-runner-letta-` folders; vitest runs each file in its own process, so the changed variables reach only this file. Both leftover checks run after the variables are set. A scratch test showed a file's root `afterAll` still runs when an inner test and inner `afterAll` fail, so the folder is removed. The acceptance command passes, 11 of 11.

**Consequence.** Nothing; the branch merges as it is.
