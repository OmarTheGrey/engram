---
date: 2026-11-19
author: claude-agent
type: change
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/scripts/dogfood-report.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - "pnpm exec vitest run packages/core/test/unit/dogfood-report.test.ts"
supersedes: none
---

**What.** The twin dogfood's violation report: `dogfoodReport` replays a member's log through the oracle and counts reads, writes, grants added and removed, denials by rule and violations; `scripts/dogfood-report.ts` (`make dogfood-report`) prints it as JSON.

**Why.** Card E9.5's acceptance: the report shows reads, grants and zero violations, and finds a planted one.

**Result.** On a realistic two weeks under the twin profile over the files adapter: 8 reads, 36 items returned (5 through a grant), 3 grants added and 1 removed, 6 denials over 5 rules, 0 violations. Each of 10 planted logs is found with exactly its count. 16 tests. Ten mutants (owner check, source check, other operations, multiset, class change, read time, status, replay order, rule ids, declared actors) each fail at least one test.

**Consequence.** The members run it at the end of the two weeks.
