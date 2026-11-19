---
date: 2026-11-19
author: claude-agent
type: finding
card: B6
chapter: limitations
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/longmemeval/plane.ts
  - packages/pi-extension/src/tag.ts
  - "ENGRAM_OFFLINE=1 node packages/runner/scripts/run.ts --config research/configs/b5-longmemeval-plane.json --out <dir>, with turnItem naming a model"
supersedes: none
---

**What.** B6's baselines inherit B5's unnamed assistant model, and naming it would not change their prompts or cassette keys.

**Why.** The lead's backlog decision (row "B5's assistant model") was said to change B5's cassette keys (`docs/log/2026-11-19-l2-review-finding-b5-assistant-model.md`).

**Result.** With `turnItem` naming a model for assistant turns (a local probe, not committed), B5's config replayed 72 of 72 calls from its cassettes with 0 new: a read renders item id, scope, rank, policy id and content, never provenance, and medium's write gate and read filter do not read the model. C5 runs no lint, so C2's and C5's decisions are the same either way.

**Consequence.** The decision only matters for C6 (card X10); it can be taken without re-recording H2's cassettes.
