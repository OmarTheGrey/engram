---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/test/unit/plane/cross-handle-review.test.ts
supersedes: docs/log/2026-11-19-e2-6-finding-lint-across-erasure.md
---

**What.** `Plane.lint` notes the log's head before its snapshot and, in the transaction that appends its findings, drops every finding about an item erased after it, or naming its id or the content hash of the version it read.

**Why.** Rerunning a model lint under the lock is impossible, and the findings about survivors stand.

**Result.** The test of a lint awaited across an offboarding passes and fails without the filter.

**Consequence.** None.
