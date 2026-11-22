---
date: 2026-11-22
author: claude-agent
type: finding
card: E2.13
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - packages/core/test/property/who-can-read.test.ts
supersedes: docs/log/2026-11-21-e2-13-finding-what-the-answer-reveals.md
---

**What.** Every field each asker is shown, after the fix pass.

**Why.** Review finding E2.13-6.

**Result.**
- Refused: the id or scope it gave, and `at`, the log head's time when later than its own; an unknown id gets the same.
- Every answer: its matrix entries (scope, level, rule id), the public policy.
- Admitted grantee: the item exists and is open; the owner id; each live grant naming it, without position.
- Member, open item: as a grantee.
- Member, closed item: that it is closed and the rule id; no owner, instant or grant.
- Owner: every grant with position, and each dormant grant with its instants.
- Scope answer, to its readers: its matrix entries.

**Consequence.** `at` also appears on every read event a reader gets, so it adds nothing.
