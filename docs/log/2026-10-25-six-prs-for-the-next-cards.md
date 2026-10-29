---
date: 2026-10-25
author: omar
type: decision
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E0.3.md
  - docs/tasks/RN1.md
supersedes: none
---

**What.** The lead asked for thirteen cards to land as six stacked pull requests instead of one card per PR (AGENTS.md rule 10): core (E0.3, E1.2, E1.3), policy loader (E2.1), adapters (A1, A4, A3), the plane read and write paths (E2.2, E2.3), Gate A surfaces (E8.2, B1), and pi (PX1, RN1).

**Why.** The cards are built in parallel by coding agents and reviewed together; grouping by dependency keeps each PR reviewable and lets each base on the one before.

**Result.** Each PR names its cards in its title and carries one log entry per card.

**Consequence.** Rule 10 is set aside for these six PRs only.
