---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-20-lead-decision-models.md
  - docs/research/preregistration.md
  - docs/research/prereg-v1-decisions.md
  - docs/decisions/0016-statistics.md
  - research/results/h2-cost-table.json
supersedes: none
---

**What.** The lead's three models (lead-decisions item 1) are written into v1's Models section, decision sheet item 1 and ADR 0016: M1 DeepSeek v4 pro, M2 GLM 5.3 Flash, M3 Mistral Large 4, with LongMemEval's judge (item 13) and the upstream rule (row RV6).

**Why.** Item 1 was the lead's own answer of 2026-11-20 and the last value v1 marked as recommended.

**Result.** The Models table names the three ids with no mark. H1 with the judge costs 274.33 to 1,251.92 dollars with reasoning off (`decided` block, option `d-lead`), 1,691.07 with the allowance as a sensitivity; gpt-5.6-terra's figures are gone. M2's reasoning cannot be turned off through pi-ai 1.3.0, which v1 states (see the finding of the same date).

**Consequence.** The endpoints and M2's reasoning go to the backlog; X2 and X3 still name the slot `prereg/M1`.
