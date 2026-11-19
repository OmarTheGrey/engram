---
date: 2026-11-19
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - packages/runner/src/judge.ts
  - research/results/h1-cost.json
supersedes: docs/log/2026-11-03-pr4b-decision-judge-openrouter.md
---

**What.** The lead accepted the recommendation of decision sheet item 19: GateMem's judge is `openrouter/openai/gpt-4o` through OpenRouter's seeded chat completions, at temperature 0 and 4,096 tokens with upstream's prompt and structured output and the row's seed.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** The judge block of `research/configs/h1-gatemem.json` is unchanged; one OpenRouter key serves the judge.
