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

**What.** V-18 of the final verification: the sheet did not name the departure from the GateMem paper's Eq. 11, which counts a wrong action in A, and v1 did not say where that reading appears.

**Why.** Item 14 named only v0.2's wording; the paper's own definition was not checked against the metric.

**Result.** Found by the last verification of PR #27 or the final verification before it.

**Consequence.** The final fix round named it; the last polish adds Eq. 12, which does the same for F.
