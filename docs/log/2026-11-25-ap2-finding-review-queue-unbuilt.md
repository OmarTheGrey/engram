---
date: 2026-11-25
author: claude-agent
type: finding
card: none
chapter: design
pillar: govern
hypothesis: none
evidence:
  - docs/tasks/absorb-plan.md
  - docs/tasks/E8.8.md
  - packages/core/src/plane/promote.ts
supersedes: none
---

**What.** The first plan left the approval workflow out because card E8.8 covered the review queue, but E8.8 was never built.

**Why.** The reason was checked against the code before deciding again.

**Result.** E8.8's status was "open"; `promote.ts` appends a `gate` event with decision `ask` whose comment says the request waits in the review queue (E8.8), and no surface lists those requests.

**Consequence.** Cards E2.19 and the rewritten E8.8 build the queue in this plan.
