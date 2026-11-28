---
date: 2026-11-28
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/results-register.json
  - "make lint"
supersedes: none
---

**What.** The first `make lint` on the branch failed: biome would reformat `research/configs/results-register.json`.

**Why.** The config was written by Python's `json.dumps` with an indent of 2, which puts every key path segment on its own line; biome joins short arrays onto one line.

**Result.** `pnpm exec biome format --write research/configs/results-register.json` fixed it; `make results-register CHECK=1` still passed, since the script reads the JSON, not its layout, and `make lint` then exited 0.

**Consequence.** An edit to the config is formatted with biome before commit.
