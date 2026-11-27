---
date: 2026-11-25
author: claude-agent
type: decision
card: L8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - packages/core/test/unit/plane/lint-read-filter.test.ts
supersedes: none
---

**What.** A lineage id that names an item retired by its own supersession is still no orphan. This holds when the linter could read that item by scope or live grant (`LintContext.canAccess`, which is `readableAt`), even though the read filter refuses it as retired.

**Why.** Under the filter every superseded predecessor would read as absent, so every successor would be flagged. The exemption adds nothing to any finding. In its own scope, the supersession's retire event is already visible to members.

**Result.** A unit test covers it. Mutation: dropping the exemption fails that test.

**Consequence.** `canAccess` is used only for this exemption. No finding names or describes an item through it.
