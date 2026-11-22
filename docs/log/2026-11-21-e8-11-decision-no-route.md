---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/ui/src/data.ts
supersedes: none
---

**What.** No route was added: the item page is built from POST /read and POST /events, which the workspace page already calls.

**Why.** The card asks for a route only if a field is missing; E2.13 and E8.14 also change the route table.

**Result.** Every field the graph, the diff and the table need is in the read's items and the visible events. `make api` was not run and sdk/ is untouched.

**Consequence.** If wrong, an item page for an item with a very long history loads the whole visible log once; it already does for the workspace.
