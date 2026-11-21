---
date: 2026-11-21
author: claude-agent
type: finding
card: X15
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - research/results/h2-perf-budget.json
  - packages/core/test/bench/count.test.ts
  - packages/core/src/plane/retention.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/read.ts
supersedes: docs/log/2026-11-21-x15-finding-linear-projection-scans.md
---

**What.** Every Plane call reads whole tables while its statement count stays fixed, and an allowed write also reads the whole read history (review finding X15-2).

**Why.** The first entry named only the projection scans.

**Result.** Rows read, now counted, at N items: an allowed write 3N+5 (`retiredContent`, `enforceBudget`, `retentionUsage` each read the projection), a denied write N+2, a read 2N+2; `count.test.ts` asserts this at 100 and 2,000 items. An allowed write also parses every read event (`retentionUsage`): 50 earlier reads add exactly 50 rows to it, a test pinned under X15-2; the review timed 0.88 ms rising to 9.16 ms after 2,000 reads at 100 items. A read also hashes every reachable item three times (`strictContentHash`). A scoped query fixes neither for a reader in every scope.

**Consequence.** Two backlog rows; the read-history scan is a production scaling problem.
