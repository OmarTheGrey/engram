---
date: 2026-11-21
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/server/src/contract.ts
  - sdk/openapi.json
  - packages/server/test/contract.test.ts
  - "make api-check"
  - "make test-one T=packages/server/test/contract.test.ts"
supersedes: none
---

**What.** Two routes, `POST /api/v1/read/{itemId}` (`readById`) and `POST /api/v1/scopes` (`listScopes`), and the regenerated client.

**Why.** Card E8.14 step 1: framework adapters reach the plane through the generated client only.

**Result.** The by-id route runs the same store sweep and adoption as `/read` first and answers in the `ReadResponse` shape; `/scopes` answers `ScopesResponse` (scopes, event, policy label). Both take the actor in the body, as every route does (no authentication in v0, ADR 0027). `make api` regenerated sdk/openapi.json, sdk/ts and packages/ui/src/api, and `make api-check` exits 0. The server contract test has 30 tests, three of them new, and its every-route-hit check covers both routes.

**Consequence.** Cards E2.13, E8.12 and E9.8 also add routes; each must rerun `make api` after merging.
