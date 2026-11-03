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

**What.** V-1: v1 promised GateMem's MGS as H1's secondary, but no part of the pipeline computed it, and the converter dropped the utility rows MGS needs.

**Why.** v0.2's line was carried into v1 without checking what produced it.

**Result.** Found by the final verification of PR #27.

**Consequence.** D1: the table computes MGS per condition in both readings; v1 and item 20 define it.
