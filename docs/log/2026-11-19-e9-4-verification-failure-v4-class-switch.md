---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Verification finding V-4 of PR #44: a role co-holder could switch a dormant grant on, or a live one off, by rewriting the item to another class with its grants unchanged.

**Why.** A first write may carry a grant of another class than its item's (the M1 outcome), which admits no read; the I1 rule looked only at whether the grants changed, so a class change to that grant's class passed as an ordinary rewrite, and the grantee then read the item.

**Result.** Fixed by decision `2026-11-19-e9-4-verification-decision-class-change.md`; three tests failed before and pass after, and mutants dropping the class rule or the check of kept grants fail them.

**Consequence.** ADR 0034's premise that an other-class grant admits no read is now stated with its condition: while the item keeps its class.
