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
supersedes: none
---

**What.** `approval` is `{ routes: [...] }`, each route a `scope` (a level or one scope), at least one approver (`owner`, a role or a principal) and an optional `expires_after` in seconds.

**Why.** E2.19 routes a scope's requests to named approvers (the owner, a role, a list) with an expiry. The research's `escalate_to` and `escalate_after` are not in E2.19's goal, so they are left out; its `scope_glob` became a level or a scope, which the plane already parses.

**Result.** `ApprovalRoute` and `Approval` in the schema. No event field is added, as the 2026-11-25 decision keeps it.

**Consequence.** Route order and matching (last match wins, per the research) are E2.19's to decide; escalation would be a second schema pull request.
