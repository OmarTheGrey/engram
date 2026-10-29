---
date: 2026-10-29
author: omar
type: milestone
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/log/2026-10-25-six-prs-for-the-next-cards.md
  - docs/tasks/gate-a-e0-e1-e2-plan.md
  - "make test"
  - "make test-invariants"
supersedes: none
---

**What.** The six stacked PRs of 2026-10-25 (#2 to #7) merged into main on 2026-10-29 after two review rounds, so thirteen cards are on main: E0.3, E1.2, E1.3, E2.1, A4, A1, A3, E2.2, E2.3, E8.2 (Gate A slice), B1 (pipeline), PX1 and RN1.

**Why.** Each PR was reviewed by an independent agent, every finding fixed test first, and each fix broken on purpose to show its test catches it; a second verification round found and fixed more (a capped-search leak, concurrent writes, shell and path bypasses, forged memory tags).

**Result.** At main `ffb05bc`: `make test` 1317 passed and 14 skipped, pytest 20; `make test-invariants` 4 passed; CI run 40835126188 green. Every card file names its PR.

**Consequence.** Phase 0 closes except Gate A's two deferred criteria; the plan for those and for E0.4, E1.1, E2.4 and E2.5 is `docs/tasks/gate-a-e0-e1-e2-plan.md`.
