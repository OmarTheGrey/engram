---
date: 2026-11-21
author: claude-agent
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/cost-table.json
  - "pnpm exec biome format --write research/configs/cost-table.json"
supersedes: none
---

**What.** `make lint` failed on a Biome format error in `decisions.exclude` of `research/configs/cost-table.json` (review finding RV8-1 of PR #65).

**Why.** The config was hand-written after the last `biome check --write`, so one array entry stayed on a single line.

**Result.** Biome's formatter reflowed that entry into the multi-line form. The script reads only the config's values, so the formatting alone changes no result byte; the cost table was regenerated anyway for the other fixes of this pass.

**Consequence.** Run `pnpm exec biome check --write .` after any config edit, before `make lint`.
