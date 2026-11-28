---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.12
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/results-register.json
  - "pnpm exec biome check --error-on-warnings ."
supersedes: none
---

**What.** After the merge of origin/main, `make lint` failed: the register resolver rewrote `research/configs/results-register.json` with every short array spread over several lines, which biome's formatter refuses.

**Why.** The resolver re-serialises the file it merges; the merge commit carried 879 reformatted lines that were not the card's.

**Result.** `pnpm exec biome format --write` on the file put main's form back; the file now differs from main's only by the consent section, and `make results-register CHECK=1` and `make results-page CHECK=1` pass.

**Consequence.** After the resolver, run biome on the register config before committing; worth noting in the resolver's instructions.
