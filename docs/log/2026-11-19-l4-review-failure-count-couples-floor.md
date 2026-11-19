---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-floor.json
  - research/configs/h3-lint-model.json
supersedes: none
---

**What.** Review finding L4-7: the floor embeds the live config's count (`model_run`), so any change to `research/configs/h3-lint-model.json` changes the floor's sha256, and `decision-count-in-floor` did not say so.

**Why.** The cost of keeping the count in the floor was left unstated.

**Result.** Superseded by `2026-11-19-l4-review-decision-count-in-floor`.

**Consequence.** A seeds, model or questions change to the live config is a floor regeneration and a MANIFEST row update.
