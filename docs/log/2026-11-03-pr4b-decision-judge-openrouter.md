---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-02-x1r2-judge-through-openrouter.md
  - packages/runner/src/judge.ts
supersedes: none
---

**What.** Recommended, for the lead's decision: GateMem's judge is GPT-4o through OpenRouter's seeded chat completions, where upstream calls OpenAI directly (decision sheet item 19).

**Why.** pi-ai serves OpenAI's own models on the Responses API, which carries no seed, and ADR 0017 refuses an unseeded live call.

**Result.** The judge sends the row's seed with upstream's prompt and schema (`docs/log/2026-11-02-x1r2-judge-through-openrouter.md`); it costs 66.06 to 264.25 dollars at H1's size (`research/results/h1-cost.json`).

**Consequence.** One key serves M1 and the judge; the plan's section 5 no longer needs an OpenAI key.
