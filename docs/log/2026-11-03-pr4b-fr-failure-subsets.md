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

**What.** V-15: v1's fixed subsets for M2 and M3 listed MEM-INV-Bench, which no hypothesis runs off M1.

**Why.** v0.2's MPBench line was replaced rather than removed.

**Result.** Found by the final verification of PR #27.

**Consequence.** The line now names no MEM-INV-Bench subset.
