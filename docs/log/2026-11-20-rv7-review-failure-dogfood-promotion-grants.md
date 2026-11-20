---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
  - "pnpm exec vitest run test/unit/dogfood-report.test.ts (in packages/core)"
supersedes: none
---

**What.** After rebasing onto main with RV4, the core suite failed one test of 1,391: the dogfood report's "a reviewer's promotion carrying a grant its class switches off is no violation". It asserted that Lee's reviewed promotion of Dana's episodic item kept her dormant episodic grant.

**Why.** This is the behaviour RV7-R1 removes on purpose: a new version made by anyone but the owner carries no grants. I had run the promotion and grant suites before committing that fix, but not the dogfood report's.

**Result.** The assertion now expects no grants on Lee's new version. The test's own point stands: the report finds no violation. The file passes (44 tests).

**Consequence.** Nothing else. The rest of the targeted gates on the rebased tree passed in the same run.
