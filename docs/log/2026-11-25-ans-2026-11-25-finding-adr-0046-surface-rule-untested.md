---
date: 2026-11-25
author: claude-agent
type: finding
card: ANS-2026-11-25
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/server/src/contract.ts
  - packages/server/src/routes.ts
  - docs/decisions/0046-replay-validation-source.md
supersedes: none
---

**What.** ADR 0046's decision 7, no surface exposes `replay` before verified actors, holds by omission and no test pins it.

**Why.** The acceptance asks for the code and the test that enforce each ADR's rule.

**Result.** `PromoteRequest` in `packages/server/src/contract.ts` is a strict object of `actor`, `item_id`, `to` and `review`, so a body with `replay` is refused; the `promote` route passes only `review`; the MCP server, the CLI and the pi extension never call `Plane.promote` with a replay. No test under `packages/server/test`, `packages/mcp/test`, `packages/cli/test` or `packages/pi-extension/test` asserts any of it. ADR 0042 is now accepted and built, so the decision's precondition is met for the HTTP surfaces; exposing `replay` is still a choice for a later card.

**Consequence.** A server test that posts a replay to `/promote` and expects 400 would pin the rule. A card that exposes `replay` should state it.
