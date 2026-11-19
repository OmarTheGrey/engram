---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: none
---

**What.** The oracle accepts a withdrawal only when its reason names an adoption event of the same item and the item it puts back equals that item just before the adoption, apart from version and store ref; a narrowing may only remove grants.

**Why.** V-4: a withdrawal by anyone restoring any earlier version hid a planted widening.

**Result.** V4's planted withdrawal reports one violation; the real withdrawals and narrowings report none.

**Consequence.** A withdrawal written by an older build of this branch fails the check; none was released.
