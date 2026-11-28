---
date: 2026-11-28
author: claude-agent
type: change
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/options.ts
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/consent.test.ts
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** Deleted consent's row in `NOT_BUILT_YET` and added `consentProblems`, which the loader reports: a topic or carve-out with no word, a carve-out equal to the topic, a window whose end is not after its start.

**Why.** E2.14 refused every consent value until this card; each consuming card lifts its own row with a loader test.

**Result.** `make test-one T=packages/core/test/unit/policy/consent.test.ts`: 41 passed, including the five loader cases and five problems, each at its path and line; load-options.test.ts lost its consent rows and still passes (95 tests with consent.test.ts). The presets' parsed hashes in load-options.test.ts are unchanged.

**Consequence.** Plane.simulate and exportCedar no longer refuse consent through the shared table; the export refuses it itself (see the Cedar decision).
