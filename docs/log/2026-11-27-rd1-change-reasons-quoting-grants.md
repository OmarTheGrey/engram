---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/src/plane/commit.ts
  - packages/core/test/counterexamples/read-disclosure.test.ts
  - packages/server/test/read-disclosure.test.ts
supersedes: docs/log/2026-11-25-rd1-finding-left-open.md
---

**What.** Every reason core writes that can quote a grantee is shown whole only to its maker and the item's owner (review finding 1, and a search for more).

**Why.** `engram/write/grant` was not on the hidden list, so a refused grant change for a malformed principal or another class named the proposed grantee to every scope member. Also: the grant rules on a write (a duplicate grant names a real grantee), the plane's narrowing after an adoption (`engram/adopt/narrowed`), and clauses under other ids: adoption's dropped grants, a store failure's mend (`removedGrantsNote`) and a promotion's grant count.

**Result.** `disclosedReason` hides by rule id on any op and cuts the clauses. Five core counterexamples and one server test pass, through the events and the export; removing `WRITE_GRANT_ID` fails three. Core's 55 related files: 1,373 passed.

**Consequence.** Item one of the left-open finding is closed; items two to four stand.
