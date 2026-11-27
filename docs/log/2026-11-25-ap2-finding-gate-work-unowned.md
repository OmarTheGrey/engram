---
date: 2026-11-25
author: claude-agent
type: finding
card: none
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/tasks/lead-decisions.md
  - docs/decisions/0035-store-independence-is-a-design-property.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Work the gates need has no card or no pull request on main: pre-tag conditions 2, 3, 5 and 7, H5's prerequisites, Gate D's request-identity check and the Knowledge dogfood.

**Why.** The plan checked what Gates C and D rest on before selecting.

**Result.** On main at `72e7ca0e`: no runner code checks a programme-wide cap (`grep -rE 'billed|programme' packages/runner/src` finds nothing); the preregistration says items 14 and 15 are not built; no config names OpenRouter endpoints; item 30's draft is owed; ADR 0035's check and item 28's card have no file.

**Consequence.** Section 9 of the plan names each; the spend cap is question 1 to the lead. The orchestrator writes the cards.
