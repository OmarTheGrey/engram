---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Verification finding V-5 of PR #44: invariant 5's grant walk passed with a read filter that ignores a grant's class.

**Why.** The walk's writes carried no grants and `grantDefect` refuses every other-class addition, so no item ever carried a grant of another class than its own.

**Result.** Fixed by decision `2026-11-19-e9-4-verification-decision-walk-grants.md`; the mutant making `liveGrants` ignore the class now fails invariant 5.

**Consequence.** The lead's second review of the file.
