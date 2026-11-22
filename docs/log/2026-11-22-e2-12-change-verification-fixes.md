---
date: 2026-11-22
author: claude-agent
type: change
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - packages/core/src/policy/cedar.ts
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: none
---

**What.** The two minor findings of E2.12's verification, fixed.

**Why.**
- E2.12-6: writes decided by a per-grant rule were skipped on the evaluator's own answer, so a per-grant check moved ahead of membership (E7) passed all 23 tests.
- E2.12-7: the U+2028 case could not fail, since Cedar does not end a `//` comment at U+2028.

**Result.**
- E2.12-6: such a write is still sent to Cedar. Cedar must name none of the rules the evaluator checks before its grant loop (membership, version, move, `grant/source`, `grant/owner`). E7 now fails 5 tests, Cedar naming `engram/write/membership`.
- E2.12-7: the exported text must hold no raw U+2028, U+2029 or other control character. Removing the escape now fails the line-break test. The comment says the escape protects readers and tools, not the parser.

Both mutants were restored in the run that applied them.

**Consequence.** The acceptance test passes 23 of 23.
