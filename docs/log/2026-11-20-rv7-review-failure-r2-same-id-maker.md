---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/test/property/visible-events.test.ts
supersedes: none
---

**What.** Review finding RV7-R2: a role context under the person's own id still saw every person-scope event. `eventVisibleTo` returned true for the event's maker before it checked the read matrix.

**Why.** The CLI and the server build a role context with the same id as the person (`packages/cli/src/setup.ts`), so the role context counts as the maker. My RV-CORE-4 repro used another id for the role context and missed this.

**Result.** The maker now sees its own event only when the event names no scope (a read, a bypass, a schema deny). The same-id repro passes; the property's oracle now judges the viewer's own events by the same rule. Mutation check: restoring the old exemption fails both tests. The server suite passes (74).

**Consequence.** A maker no longer sees its own denied write into a scope it may not read. ADRs 0009 and 0027 say so.
