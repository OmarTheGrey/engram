---
date: 2026-11-19
author: claude-agent
type: finding
card: B6
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - docs/log/2026-11-19-b6-finding-assistant-model-events.md
  - packages/core/src/schema.ts
  - research/results/h3-fault-set.json
supersedes: docs/log/2026-11-19-l2-review-finding-b5-assistant-model.md
---

**What.** Card L2's finding on B5's assistant model, corrected on one point: naming the model changes B5's events, not its cassette keys.

**Why.** L2's entry said the one-line change to `turnItem` changes B5's events and so its cassette keys; review P6-4 of PR #51 checked both halves.

**Result.** The events change, since `MemoryEvent.item` carries provenance. The cassette keys do not: with the model named, B5's config replays 72 of 72 calls with 0 new, because no read renders provenance. The rest of L2's finding stands: as B5 writes them, L1's missing-provenance lint flags 124,334 of 246,750 turns (`research/results/h3-fault-set.json`).

**Consequence.** The lead's decision on the backlog row "B5's assistant model" costs no cassette recording.
