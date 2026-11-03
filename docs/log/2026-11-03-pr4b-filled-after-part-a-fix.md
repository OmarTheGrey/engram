---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/research/prereg-v1-decisions.md
  - docs/tasks/prereg-v1-plan.md
  - research/results/h1-cost.json
supersedes: none
---

**What.** The v1 text, the decision sheet, section 7 and cards R1, X2 and X4 carry part A's fixed results and design in place of the placeholders.

**Why.** The orchestrator rebased part B onto part A's review fixes (`d29e6ae`) and sent their numbers.

**Result.** From `research/results/h1-cost.json` (`f147daf7`): M1 with the judge 389.58 to 3,105.53 dollars, Mistral large 173.42 to 1,004.94, DeepSeek v4 pro 170.20 to 977.66, the judge 66.06 to 264.25; the Anthropic `:batch` and alias rows priced, not candidates. From `research/results/h1-refusal-leaks.json` (`d7e9f3d0`): the sensitivity list. Design: `h1-sessions/2`, `h1-readings/1`, `gatemem_primary`, `READINGS=`, the two-phase audit. Section 7 adds the MANIFEST commit rewrite to the PR that writes the answers, and what the PR that runs H1 commits.

**Consequence.** No placeholder remains.
