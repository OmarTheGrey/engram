---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - sdk/openapi.json
  - "make api"
supersedes: none
---

**What.** Review finding RV7-R8: the `/events` route's description now says what `visibleEvents` does. It shows events naming a member scope the read matrix lets the viewer's level read, and the viewer's own events that name no scope.

**Why.** It still said "those in its member scopes" after RV-CORE-4. RV5 has merged, so editing its file no longer collides.

**Result.** `make api` regenerated `sdk/openapi.json`, `sdk/ts/src/schema.ts` and `packages/ui/src/api/schema.ts`; only the description changed.

**Consequence.** Nothing else.
