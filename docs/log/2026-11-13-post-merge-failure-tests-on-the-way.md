---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/offboard-edges.test.ts
  - packages/core/test/property/lint-leak.test.ts
supersedes: none
---

**What.** Three tests written for the post-merge integration fixes were wrong on the first try.

**Why.** The read race test first ran the offboarding before the fake search computed its hits, so the store returned nothing and the test passed on unfixed code; it now finds its hits first. The lint property first counted an outside item's content hash as a leak even when an item in the linted scope had the same content, which a duplicate finding may show. The failed-delete test asserted adoption allows nothing, but adoption re-gates any plane-written item as an import version; it now asserts no erased item comes back.

**Result.** Each was corrected before its fix landed, and each fix was broken on purpose to show its test then fails.

**Consequence.** A race test is trusted only after it has failed on the unfixed code.
