---
date: 2026-11-22
author: claude-orchestrator
type: finding
card: E2.13
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - packages/core/test/property/who-can-read.test.ts
supersedes: docs/log/2026-11-22-e2-13-finding-everything-the-answer-reveals.md
---

**What.** The fields each asker is shown, corrected by the verification (finding E2.13-7).

**Why.** The superseded entry said every answer shows matrix entries, and omitted the owner's closed reason.

**Result.**
- Refused: the id or scope it gave, and `at`; an unknown id gets the same.
- Answered, open item: matrix entries (scope, level, rule id). A closed item lists no readers.
- Admitted grantee or member, open item: the owner id and each live grant naming it, without position.
- Member, closed item: that it is closed and the rule id; no owner, instant or grant.
- Owner: every grant with position, dormant grants with instants, and its closed reason with the item's own instants.
- Scope answer: its matrix entries.

**Consequence.** `at` appears on every read event a reader gets, so it adds nothing.
