---
date: 2026-11-20
author: claude-orchestrator
type: finding
card: RV8
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** OpenRouter's public model list, read on 2026-11-20 after card RV8 priced it, gives `deepseek/deepseek-v4-pro-0813` at $1.32 and $3.96 per million input and output tokens. RV8's price file, from the same day, has $0.22 and $9.50.

**Why.** It is not known whether the price changed during the day or the price file is wrong. Either way, the cost of the lead's chosen models (M1 DeepSeek v4 pro) cannot be read off RV8's table.

**Result.** GLM 5.3 Flash, the new M2, is missing from RV8's price file.

**Consequence.** RV8 fetches the prices again, adds `z-ai/glm-5.3-flash`, and prices the lead's set before any `spend_ceiling_usd` is written into a config. It also states which fetch its numbers come from.
