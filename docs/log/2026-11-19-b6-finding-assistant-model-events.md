---
date: 2026-11-19
author: claude-agent
type: finding
card: B6
chapter: limitations
pillar: research
hypothesis: H2
evidence:
  - packages/core/src/schema.ts
  - packages/pi-extension/src/tag.ts
  - "ENGRAM_OFFLINE=1 node packages/runner/scripts/run.ts --config research/configs/b5-longmemeval-plane.json --out <dir>, with turnItem naming a model"
supersedes: docs/log/2026-11-19-b6-finding-assistant-model-keys.md
---

**What.** Naming B5's assistant model changes the write events but not the prompts or the cassette keys of C2 and C5.

**Why.** Review P6-4 of PR #51: the earlier entry said the choice changes nothing, but a write event's `item` (`MemoryEvent.item`) carries the item's provenance, model included.

**Result.** With `turnItem` naming a model (a local probe, not committed), B5's config replayed 72 of 72 calls with 0 new: a read renders item id, scope, rank, policy id and content, never provenance. The Engram log's write events do differ, by the model field. C5 runs no lint, so its decisions are the same.

**Consequence.** The lead's choice (backlog row "B5's assistant model") needs no re-recording of H2's cassettes; it changes the logs and matters for C6 (card X10).
