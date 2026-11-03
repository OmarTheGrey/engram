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

**What.** V-11: v1 did not describe the runner's in-process Mem0, and item 2 weighed time but not fidelity.

**Why.** The store's configuration was in the code, not the text.

**Result.** Found by the final verification of PR #27.

**Consequence.** v1 and item 2 state it.
