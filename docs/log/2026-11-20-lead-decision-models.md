---
date: 2026-11-20
author: lead
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** The lead chose the three models (decision-sheet item 1, lead-decisions item 1): M1 DeepSeek v4 pro, M2 GLM 5.3 Flash, M3 Mistral Large 4. All three run through OpenRouter as `deepseek/deepseek-v4-pro-0813`, `z-ai/glm-5.3-flash` and `mistralai/mistral-large-4-0`.

**Why.** It was the one decision the orchestrating session could not close under the lead's delegation, because it sets the spend. The three come from three makers, as ADR 0016 requires.

**Result.** OpenRouter's public list on 2026-11-20 shows `seed` supported on all three. GLM 5.3 Flash costs $0.04 and $0.078 per million input and output tokens. Every decision in `docs/tasks/lead-decisions.md` is now closed.

**Consequence.** Card RV8 prices this set again before the ceilings are set; see the finding of the same date.
