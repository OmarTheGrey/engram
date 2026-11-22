---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: none
---

**What.** The first run of the differential test failed three of 15 tests, none of them a disagreement.

**Why.** The coverage guard required source isolation to decide on the presets, which it cannot (`2026-11-21-e2-12-finding-isolation-never-decides.md`); `policySetTextToParts` returns policies in Cedar's order, not the text's; and the test's bit-order key added two 32-bit halves as a double, past 2^53.

**Result.** The isolation guard moved to the generated policies, the parts are compared as sorted lists, and the key is a BigInt. All 15 pass. The six agreement properties passed on the first run.

**Consequence.** Nothing further.
