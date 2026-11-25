---
date: 2026-11-25
author: claude-agent
type: change
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/write-grants.test.ts
  - packages/server/test/errors.test.ts
  - packages/cli/test/promote.test.ts
  - packages/mcp/test/mcp.test.ts
supersedes: none
---

**What.** Part 1 of E2.21: tests for two rules that held with no test.

**Why.** The lead's acceptance asks for the test that enforces each ADR's rule (the 2026-11-25 findings on item 35 and ADR 0046's decision 7).

**Result.** Item 35: the owner's class-changing promotion keeps an episodic grant on the semantic version, and the grantee, who read the episodic item before, reads nothing after, through `Plane.promote` and `Plane.read`. Decision 7: `POST /api/v1/promote` is 400 with `replay` and 200 without, and `sdk/openapi.json` offers no field beyond actor, item_id, review and to; `engram promote --replay` exits 2 with nothing logged; no MCP tool promotes or takes `replay`. Mutation checks: dropping the class match in `liveGrants`, a plain `z.object` for `PromoteRequest`, and a `--replay` option each fail their test. No source file changed.

**Consequence.** A card exposing `replay` must change these tests on purpose.
