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
  - research/results/h1-cost.json
supersedes: none
---

**What.** Recommended, for the lead's decision: every condition runs every model with reasoning off, and only models pi-ai can run that way are candidates (decision sheet item 1).

**Why.** Part A's review found six candidates for which pi-ai sends no reasoning parameter, so the provider's default effort applies whatever the runner asks: gpt-6.1-sol, gemini-4-argon, gemini-3.8-flash, qwen3.8-max, muse-wonder and muse-glimmer-30b.

**Result.** Within H1 such a model reasons alike in every condition, so C4 minus C5 stays fair. But its effort is an unstated provider default that can change during a run and is not in the cache key, so v1 could not say what it tested; reasoning tokens raise cost; and in H4's model family one reasoning model beside two that do not would mix reasoning into the model difference.

**Consequence.** Google leaves the candidates; the marks come from part A's fixed cost table [pending].
