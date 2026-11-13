---
date: 2026-11-13
author: claude-agent
type: failure
card: E8.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/simulate.ts
  - pnpm exec vitest run packages/core/test/unit/plane/simulate.test.ts
supersedes: none
---

**What.** The review of PR #28 found that the simulator reported a read as changed when both policies returned the same promoted item.

**Why.** Ids came from one counter over the whole replay, and a promotion's new item takes an id from it. A candidate that evicted one item earlier appended one event more, so its promoted item got the next id, and the read's returned ids differed.

**Result.** A new test (a budget eviction, then a reviewed promotion to org, then a read) failed with `...0003` against `...0004`. Ids are now the step's index plus a counter restarting at each step; the test passes, and the acceptance tests are unchanged.

**Consequence.** ADR 0032 is amended (decision 2, and a limit on naming promoted items).
