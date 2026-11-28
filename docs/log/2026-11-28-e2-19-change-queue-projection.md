---
date: 2026-11-28
author: claude-agent
type: change
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
  - packages/core/src/plane.ts
  - packages/core/test/unit/plane/approvals.test.ts
  - "make test-one T=packages/core/test/unit/plane/approvals.test.ts"
supersedes: none
---

**What.** The approval queue in core: `approvalQueue`, a pure projection of requests (pending, approved, denied, expired) keyed by item id and version, and three Plane methods: `approvals` (the queue as one actor may see it, no event), `refuse` (an approver's refusal with a reason) and `expireRequests` (a sweep recording each due request as one `promote` deny under `engram/approval/expired`).

**Why.** Card E2.19, steps 1 and 3; card E8.8 builds the surfaces on these.

**Result.** The unit file: 28 passed, covering routing, self-approval, agents, a lead outside the team, exact-before-level routes, the ask's reason, owner routes, the sweep, an attempt after expiry, a rewrite as a new request, refusals of candidates and widenings, the listing, the loader and the Cedar export.

**Consequence.** No route, MCP tool or CLI command is added: E8.8's.
