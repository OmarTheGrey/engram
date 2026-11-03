---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** v1's H4 names files, Mem0 and Letta, but the runner's stores are fake, Mem0 and Letta.

**Why.** `packages/runner/src/stores.ts` was not checked against H4's text.

**Result.** Found by the final verification of PR #27.

**Consequence.** v1, item 12 and card X9 say the files store joins before H4.
