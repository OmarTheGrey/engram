---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** An item's answer goes to an actor the read filter admits the item to now, or who may read its scope as a member (`readableScope`). The "owner" who is shown every grant is the one `Plane.changeGrants` knows: id equal to `item.owner` and a reader of the scope as a member.

**Why.** The schema has no scope owner. A scope member already sees the scope's events (visible.ts), so answering it reveals nothing new; a grantee is answered only while its grant admits a live item, so an expired grant or a candidate tells it nothing. A role context under the person's id is not answered about the person scope (RV7-R2).

**Result.** The leak property pins it: every other asker gets the unknown id's answer word for word.

**Consequence.** If the lead wants a scope owner apart from membership, it is a new concept and a schema question.
