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

**What.** V-8: section 7 put the label audit after the PR that writes the answers, though the audit's rejected items belong in the tagged text, and left out the ADR status lines and the full MANIFEST rewrite.

**Why.** The steps were listed in the plan's order, not checked for dependencies.

**Result.** Found by the final verification of PR #27.

**Consequence.** Reordered; the PR's duties listed.
