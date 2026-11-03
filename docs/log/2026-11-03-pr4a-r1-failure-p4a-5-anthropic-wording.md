---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-03-pr4a-finding-seeded-routes.md
  - research/results/h1-cost.json
supersedes: none
---

**What.** Part A's report and `PR.md` said Anthropic's models are "served only on `anthropic-messages`"; `anthropic/claude-*-5.5:batch` and `~anthropic/claude-*-latest` are on `openai-completions` in the same catalogue.

**Why.** The report shortened the seeded-routes finding, which named those entries, into a wrong absolute. Found by the review (P4A-5).

**Result.** The four entries are now in the cost table as priced non-candidates: the `:batch` ones, named "(batch)" at half the interactive price, because whether OpenRouter serves them as synchronous chat completions and passes the seed cannot be checked without a call; the `~...-latest` ones because they float. `PR.md` and the report use the finding's wording (superseded by `pr4a-r1-finding-seeded-routes`).

**Consequence.** A summary keeps a finding's qualifiers.
