---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-03-orch-manifest-commit-after-squash.md
supersedes: docs/log/2026-11-03-pr4b-decision-manifest-commit.md
---

**What.** Recommended, for the lead's decision: the PR that writes the answers into v1 rewrites the commit cell of all eight MANIFEST rows to PR 4's squash commit (decision sheet item 17).

**Why.** the final verification of PR #27 (P4V-7): PR 4 changed the code behind the reach, H4 power, C4 walk and agreement rows too, not only its own new rows.

**Result.** Nobody edits the commit cells in this round; the plan's section 7 names the step.

**Consequence.** None for `make test-repro`, which does not read the column.
