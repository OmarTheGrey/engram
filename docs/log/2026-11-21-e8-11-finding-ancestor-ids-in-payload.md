---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.11
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane/adopt.ts
  - packages/core/src/plane/offboard.ts
  - packages/core/src/lint/det.ts
  - packages/core/src/visible.ts
supersedes: docs/log/2026-11-21-e8-11-finding-lineage-in-payload.md
---

**What.** Ancestor ids reach a viewer by two routes, not one: an item's `lineage` field, and the reasons core writes into events.

**Why.** Review finding E8.11-5: the earlier entry named only `lineage`.

**Result.** Reasons naming a lineage ancestor: write.ts:335 and write.ts:539, promote.ts:262, adopt.ts:568, offboard.ts:648, and the orphan lint's evidence at lint/det.ts:190. visibleEvents filters neither field. The inspector prints reasons in the event table's rows and tooltips, in the version diff's "made by event" line and in the event detail. The graph never makes a node from them. The provenance fixture has no such reason, so its leak test does not exercise them. No core code changed.

**Consequence.** For the lead's future core card: cut lineage to readable ids at the read, and reword these reasons for readers who cannot see the ancestor.
