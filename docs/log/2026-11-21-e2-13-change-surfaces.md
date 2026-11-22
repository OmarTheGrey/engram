---
date: 2026-11-21
author: claude-agent
type: change
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/cli/test/who-can-read.test.ts
  - packages/ui/src/WhoCanRead.tsx
  - test/e2e/who-can-read.e2e.test.ts
  - make api-check
supersedes: none
---

**What.** Two routes, `POST /api/v1/who-can-read/item` (`whoCanReadItem`) and `POST /api/v1/who-can-read/scope` (`whoCanRead`), regenerated into sdk/ and the UI client by `make api`; `engram who-can-read <item-id> | --scope <scope>` as one client call; and a "Who can read this" panel on the inspector's item page.

**Why.** Step 4 of card E2.13. Every surface calls the plane and decides nothing (AGENTS.md rule 1).

**Result.** Contract test 29 of 29; CLI 4 of 4 (owner, grantee, refused outsider equal to an unknown id, one request, no event); inspector e2e 4 of 4 in Chromium on the twin workspace, beside E8.11's item page and E9.4's twin screens (25 of 25 over the three files); `make api-check` exit 0.

**Consequence.** AGENTS.md and CLAUDE.md list the command. E8.12 and E8.14 also add routes: whoever merges after this reruns `make api`.
