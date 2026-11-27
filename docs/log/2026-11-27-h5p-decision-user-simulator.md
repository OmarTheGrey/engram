---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** The user simulator is `openrouter/openai/gpt-4.1`, temperature 0, seeded, pinned to an OpenRouter upstream, and retail's judge is routed to the same alias.

**Why.** It is tau2's paper's simulator; pi-ai 1.3.0's OpenRouter catalogue lists no dated gpt-4.1 for the judge's `gpt-4.1-2025-04-14` (`docs/log/2026-11-21-b11-finding-reward-and-judge.md`).

**Result.** The undated alias is a stated limitation, as GateMem's judge's is. Proposed, card H5P item 14.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.
