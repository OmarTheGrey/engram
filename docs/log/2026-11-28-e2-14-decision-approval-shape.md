---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.14
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - docs/tasks/E2.19.md
  - docs/research/absorb/18a-approval-workflow.md
  - docs/log/2026-11-25-ap2-decision-approvals-without-schema.md
  - docs/decisions/0026-promotion-corroboration-and-review.md
supersedes: none
---

**What.** `approval` is `{ routes: [...] }`, each route a `scope` (a level or one scope), at least one approver and an optional `expires_after` in seconds. An approver is typed: `owner`, `role:<id>` or `person:<id>`; a route narrows ADR 0026's eligible reviewers and never widens them, and `owner` is ADR 0049's owner acceptance, for a person-scope route only.

**Why.** E2.19 routes a scope's requests to named approvers (the owner, a role, a list) with an expiry. Escalation is not in E2.19's goal, so it is left out; the research's `scope_glob` became a level or a scope. The review of 2026-11-28 found free-string approvers, with `owner` on a team route, preset self-approval; typing them is free while every value is refused.

**Result.** `Approver`, `ApprovalRoute` and `Approval` in the schema; no event field added.

**Consequence.** Route order and matching are E2.19's to decide; escalation would be a second schema pull request.
