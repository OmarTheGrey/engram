---
date: 2026-11-19
author: claude-agent
type: change
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/server/src/contract.ts
  - packages/server/test/contract.test.ts
  - sdk/openapi.json
  - "make api-check"
supersedes: none
---

**What.** The route table gained `POST /api/v1/grants` (operation `changeGrants`, request `GrantRequest`, response `GrantResponse`), and `make api` regenerated `sdk/openapi.json`, `sdk/ts` and `packages/ui/src/api`.

**Why.** The inspector reaches the plane only through the generated client (ADR 0027, decisions 1 and 2), so the grants editor needs the operation on the table.

**Result.** The handler calls `Plane.changeGrants` and holds no policy logic (rule 1). Three contract tests: an allowed change is 200 with its update event and the new version, after which the grantee reads the item; a refused one is 200 with its deny event; a change adding and removing nothing is 400 `invalid_call` with no event. `packages/server/test` passes, 58 tests.

**Consequence.** `engram serve` serves the route; no CLI command or MCP tool calls it (ADR 0034, decision 6).
