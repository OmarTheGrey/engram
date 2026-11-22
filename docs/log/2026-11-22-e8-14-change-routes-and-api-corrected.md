---
date: 2026-11-22
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/server/test/contract.test.ts
  - packages/server/test/auth.test.ts
  - "make api-check"
supersedes: docs/log/2026-11-21-e8-14-change-routes-and-api.md
---

**What.** The two routes as they now stand: `/scopes` runs the store sync and answers its report, and both run under E8.12's credentials.

**Why.** Review finding E8.14-11 and the merge of card E8.12 (ADR 0042) changed what the earlier entry described.

**Result.** `ScopesResponse` is scopes, event, sync and the policy label. On a server with credentials both routes are 401 without one, act as the credential's actor (attested), and refuse another actor or a membership it does not hold with 403, appending nothing (3 tests in `auth.test.ts`). The contract test has 31 tests. `make api-check` exits 0.

**Consequence.** Nothing further.
