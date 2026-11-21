---
date: 2026-11-21
author: claude-orchestrator
type: change
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/absorb-plan.md
  - docs/roadmap.md
  - docs/decisions/README.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** PR #69, the absorb plan, had one independent review; its nine findings (none a blocker, seven to fix, two sets of nits) are all fixed.

**Why.** Every PR gets an independent review and a fix pass before merge.

**Result.** The review checked internal consistency, rule conflicts and prose fully, and repository facts, outside licences, the ADRs and card clarity in part. Clean: thirty cards, the effort arithmetic, the dependency order, fifteen sources' licences against GitHub, and no copy or port from a source the research rules out. Before the fixes ADRs 0038 to 0041 were proposed; after them and the lead's delegation they are accepted.

**Consequence.** Left unverified and stated in the cards: file-level licence headers of each source (checked by each absorbing card) and the age of two pinned versions.
