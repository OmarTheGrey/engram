---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/grants.test.ts
supersedes: none
---

**What.** PR #44's test that an erasure committed meanwhile refuses a grant change, expecting the reason to say `erased`, failed once the check reported the begun offboarding before the missing item.

**Why.** Both conditions held, and the check named the scope's offboarding first.

**Result.** The check now names the item first (erased or removed), then a begun offboarding; the test passes unchanged.

**Consequence.** None.
