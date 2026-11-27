---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/visible.ts
  - packages/core/test/counterexamples/read-disclosure.test.ts
supersedes: none
---

**What.** The promotion's "grants not carried" clause is built once, by `notCarriedClause` in `policy/promotion.ts`, and `visible.ts` derives the pattern it cuts from that builder (verification N3).

**Why.** `visible.ts` held a copy of the sentence as a literal regex, so a rewording in the promotion gate would have left the count shown with only one test to notice.

**Result.** The reason's bytes are unchanged (`write-grants.test.ts` and `promote.test.ts` pass). The singular form is now pinned too. A pattern that matches nothing fails the promotion counterexample. Four files: 133 passed.

**Consequence.** Nothing further.
