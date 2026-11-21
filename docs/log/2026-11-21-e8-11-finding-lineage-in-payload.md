---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.11
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/server/src/routes.ts
  - fixtures/workspaces/inspector/provenance.json
supersedes: none
---

**What.** The JSON the server sends a viewer names ancestors it cannot read: an item's `lineage`, in a read's items and in a visible event's item, lists every id it supersedes.

**Why.** Found while writing the leak test: sam's read returns the checklist with the note's id in its lineage.

**Result.** The inspector shows none of it, which is the card's test, but the ids are in the response a client receives. Neither Plane.read nor visibleEvents filters lineage; the ids are opaque, and no content goes with them.

**Consequence.** For the lead: whether lineage should be cut to readable ids at the read is a core decision for its own card.
