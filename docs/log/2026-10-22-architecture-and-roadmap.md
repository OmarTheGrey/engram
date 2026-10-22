---
date: 2026-10-22
author: omar
type: milestone
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/architecture.md
  - docs/roadmap.md
  - AGENTS.md
supersedes: none
---

**What.** The architecture (`docs/architecture.md`, as decided on 2026-10-22) and the roadmap (`docs/roadmap.md`, prepared 2 October 2026) were added to the repository, and AGENTS.md now points to both.

**Why.** Step-0 tasks S0.7 to S0.13 implement the architecture's memory model and interfaces, and S0.13 expands the roadmap's task cards into `docs/tasks/`; until now both were referenced but missing.

**Result.** Two living documents. The roadmap still describes the Python-first v1 layout for cards E0.1, E0.3, E8.1 and E8.3, which ADR 0001 supersedes; S0.13 rewrites those cards.

**Consequence.** Schema v0 (S0.7) follows the architecture's MemoryItem, MemoryEvent and Policy fields; the hypotheses in the pre-registration (S0.12) follow the roadmap's gates and experiment cards.
