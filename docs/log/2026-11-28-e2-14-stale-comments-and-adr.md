---
date: 2026-11-28
author: claude-agent
type: change
card: E2.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - docs/decisions/0002-schema-and-generated-contracts.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The `ContentGuards` and `Trust` doc comments now say every option is enforced (E2.9, E2.10, E2.11), and ADR 0002 gains a line naming this card's use of decision D2.

**Why.** The backlog recorded both comments as wrong since those cards merged, and rule 5 left the fix to the next schema pull request, this one.

**Result.** The comments name `policy/secrets.ts`, `policy/injection-screen.ts` and `policy/trust.ts`, which exist. ADR 0002's new paragraph lists the seven options and their cards.

**Consequence.** The backlog row "Stale `ContentGuards` comment in the schema" can be closed at merge.
