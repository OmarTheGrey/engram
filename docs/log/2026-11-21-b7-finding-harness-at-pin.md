---
date: 2026-11-21
author: claude-agent
type: finding
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/PINS.md
supersedes: none
---

**What.** What MERIT's harness does at the pin, for card X7.

**Why.** The launcher depends on it and the next harness card will too.

**Result.** LiteLLM sends `model`, `messages`, `tools`, `temperature` only, and puts `provider_specific_fields` into the assistant messages it echoes back (hashed by the proxy, stable). It fetches its price map unless LITELLM_LOCAL_MODEL_COST_MAP=True, which the launcher sets. The lock installs on Windows with colorama 0.4.6 added. The process gets no provider key: the launcher passes a fixed environment.

**Consequence.** Recorded in PINS.md's notes.
