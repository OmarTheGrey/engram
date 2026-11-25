---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: govern
hypothesis: none
evidence:
  - docs/tasks/E2.19.md
  - docs/research/absorb/18a-approval-workflow.md
supersedes: none
---

**What.** The approval queue keys a request by its candidate's id and version, not by a new `request_id` field on events.

**Why.** The research proposed a request id in a schema pull request; that would bump `schema_version`. A candidate version has at most one open request, so the id and version identify it.

**Result.** Card E2.19 is a pure projection over the `gate` events `promote.ts` already appends, and card E2.14 adds only the policy's `approval` block.

**Consequence.** If two requests per version are ever needed, a schema change is required then.
