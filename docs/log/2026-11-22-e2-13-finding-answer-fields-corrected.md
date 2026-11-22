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

**What.** Every field each asker is shown, after the fix pass, with two corrections from the verification (finding E2.13-7).

**Why.** The superseded entry said every answer shows its matrix entries, and left the owner's closed reason out of its list.

**Result.**
- Refused: the id or scope it gave, and `at`, the log head's time when later than its own; an unknown id gets the same.
- Answered, open item: its matrix entries (scope, level, rule id) and the public policy. A closed item's `readers` list is empty.
- Admitted grantee: the item exists and is open; the owner id; each live grant naming it, without position.
- Member, open item: as a grantee.
- Member, closed item: that it is closed and the rule id; no owner, instant or grant.
- Owner: every grant with position, each dormant grant with its instants, and its closed reason with the item's own instants, which are the owner's data.
- Scope answer, to its readers: its matrix entries.

**Consequence.** `at` also appears on every read event a reader gets, so it adds nothing.
