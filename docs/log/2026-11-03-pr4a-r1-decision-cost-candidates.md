---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
supersedes: docs/log/2026-11-03-pr4a-decision-cost-candidates.md
---

**What.** The candidates: per maker on OpenRouter's chat completions in pi-ai 1.3.0's catalogue, a large and a small tier, each the maker's newest general model of that tier; references `gpt-5.6-terra` and `gpt-4o`; Anthropic's two current models, which the runner refuses; and Anthropic's chat-completions variants, priced but not candidates.

**Why.** The superseded entry said `-pro` variants were excluded, yet DeepSeek's large pick is `deepseek-v4-pro-0813` (review P4A-7).

**Result.** The true rule excludes a `-pro` that is a premium variant of a model also listed without it (OpenAI's `gpt-*-pro`); where "pro" names the maker's large tier against its "flash" (DeepSeek), it is the large pick. Also excluded: `:free`, preview, code, image and audio variants, and other makers' `:batch` entries. Anthropic's `:batch` and `~...-latest` entries are listed with `why_not` (P4A-5). xAI shows one tier.

**Consequence.** One config line adds a model; the shapes do not change.
