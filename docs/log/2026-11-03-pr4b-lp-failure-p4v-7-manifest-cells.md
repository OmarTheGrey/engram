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

**What.** P4V-7 of the final verification: section 7 and item 17 had the PR that writes the answers rewrite only PR 4's new MANIFEST rows, though PR 4 also changed the code behind the reach, H4 power, C4 walk and agreement rows.

**Why.** The rows were chosen by who added them, not by whose code produced the result.

**Result.** Found by the last verification of PR #27 or the final verification before it.

**Consequence.** All eight rows' commit cells are rewritten to PR 4's squash commit (D7).
