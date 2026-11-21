---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/upstream.ts
  - research/configs/openrouter-prices.json
  - docs/log/2026-11-20-rv6-openrouter-upstream.md
supersedes: none
---

**What.** The configs gain no `openrouter_provider`: the upstream rule is written into v1 and ADR 0017, and naming each endpoint is left to a pre-run step.

**Why.** The rule (row RV6) picks the maker's own endpoint where OpenRouter lists one, else the cheapest that honours `seed`. Which endpoints OpenRouter lists is in its per-model endpoint list, which no committed file holds (`openrouter-prices.json` has prices only) and which this card may not fetch. A wrong slug would make the live run fail, and a pin changes the run's cassette folder.

**Result.** H1's configs route freely until named; the serving upstream is recorded either way (card RV6).

**Consequence.** Before the smoke run, someone with network reads the endpoint list for M1 and both judges and writes the pins, a backlog row.
