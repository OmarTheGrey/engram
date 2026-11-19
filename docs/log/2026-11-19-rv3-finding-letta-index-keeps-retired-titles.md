---
date: 2026-11-19
author: claude-agent
type: finding
card: RV3
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/letta/index.ts
  - docs/decisions/0028-letta-adapter-over-memfs.md
supersedes: none
---

**What.** The Letta adapter's `engram/MEMORY.md` keeps one line per item, retired items included, each with the item's title, the same exposure RV-ADP-3 removed from the files adapter, though only on demand.

**Why.** Seen while amending ADR 0028's comparison of the two file stores: `indexLine` puts the title in every line, and a retirement is a rewrite that keeps the line; Letta reads `engram/MEMORY.md` only when the agent opens it.

**Result.** Not changed: the card names RV-ADP-3 for the files adapter, the dogfood runs on the files adapter, and the Letta index is read on demand rather than loaded into every prompt.

**Consequence.** A backlog row: drop the title from the Letta index line, or the line of a retired item.
