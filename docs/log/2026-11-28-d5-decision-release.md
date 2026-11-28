---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - docs/decisions/0026-promotion-corroboration-and-review.md
  - docs/decisions/0049-owner-accepts-in-own-person-scope.md
supersedes: none
---

**What.** Who may release a hold applies ADRs 0026 and 0049, with no new ADR: in the owner's own person scope, the owner acting as user; in any other target, a reviewer's widening of an active procedure included, only a distinct user-sourced member of the target who neither owns nor wrote it (`reviewerProblem`). Any other release is a deny event under `engram/promote/safety-scan`.

**Why.** The review (finding 2) and the coordinator's decision: the first draft let any user-sourced actor release, so the owner who ran the replay could release a flagged procedure into a shared scope alone, against ADR 0049 decision 5.

**Result.** Tests: the owner's release in a team scope is one deny event, the item a candidate; a distinct member releases it; a reviewer widening an active procedure is held, then releases it; an author is refused.

**Consequence.** The releaser presents the replay or review itself, in one call.
