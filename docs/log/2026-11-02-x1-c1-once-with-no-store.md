---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/config.ts
  - packages/runner/test/count.test.ts
supersedes: none
---

**What.** C1 opens no store, so its sessions, rows and cache keys name the store `none` and the preset `none`, and it runs once per item and seed whatever the config's store list (`configCells`).

**Why.** C1's memory is the prompt's long context; running it once per store would pay for identical prompts under different keys, and naming a store would claim it read one. C2 already names preset `none` for the same reason (it states and enforces no policy).

**Result.** On a two-store GateMem config COUNT gives C1 4 sessions and every other condition 8 (`count.test.ts`).

**Consequence.** H2's C1 arm costs one run per item and seed, not one per store; summaries key it `C1@none` when a config names several stores.
