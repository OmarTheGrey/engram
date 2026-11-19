---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Verification finding V-7: mutants M7b, M7c, M12 to M17 and M19 survived the tests, and the two-handle walk neither stopped an offboarding nor checked committed grant decisions.

**Why.** The tests covered the outcomes the reviewer named, not each mechanism.

**Result.** Each now has a test that kills it on both backends (M17's function was removed with the rule it served); the walk stops offboardings after their mark, reruns them, and checks every committed grant removal stands. Of fourteen mutants rerun, thirteen died at once and M14 after its test also checked the store before the erasure commits.

**Consequence.** None.
