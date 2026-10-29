---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - fixtures/workspaces/inspector/workload.json
  - test/e2e/inspector.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The first fixture workload let a parser that swaps two filtered categories pass the Playwright test.

**Why.** The mutation check "the counts parser off by a category" (plan, PR 4) swapped `not_active` and `expired` in `parseReadReason`. The property test failed, as it should, but the e2e test passed: the fixture read had one item in each of those categories, so the swap changed nothing on the page.

**Result.** Three writes were added (a second candidate, an item valid only from November, one valid only in September), so the read's categories are 3, 2, 1 and 0. With them the same mutation fails the e2e test's category check; restored, all 7 steps pass.

**Consequence.** Fixture counts that a test compares by category are kept distinct.
