---
date: 2026-11-21
author: claude-agent
type: finding
card: none
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/configs/cost-table.json
  - docs/research/preregistration.md
  - "node_modules/@earendil-works/pi-ai/dist/providers/data/openrouter.json, entry z-ai/glm-5.3-flash"
supersedes: none
---

**What.** pi-ai 1.3.0's OpenRouter catalogue lists `z-ai/glm-5.3-flash`, the lead's M2, with `thinkingLevelMap.off` null, so the runner cannot turn its reasoning off.

**Why.** v1's Models section excludes any model for which pi-ai sends no reasoning parameter, since it runs at the provider's unstated default effort.

**Result.** M1 (`deepseek/deepseek-v4-pro-0813`) and M3 (`mistralai/mistral-large-4-0`) map off to `none`, so both honour it. Card RV8's decision entry said the catalogue does not list GLM 5.3 Flash; it does, and its conclusion, an off switch that is ignored, stands. The cost table already prices M2 that way.

**Consequence.** v1 states the conflict, and the lead decides before M2's first run, after Gate C: keep M2 at its default effort and say so, or another M2 from a third maker that can turn reasoning off.
