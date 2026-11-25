---
date: 2026-11-25
author: claude-agent
type: decision
card: RD1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - docs/decisions/0047-by-id-read-and-scope-list.md
  - packages/ui/src/provenance.ts
supersedes: none
---

**What.** An unreadable lineage id is dropped, with no count and no placeholder. An id is kept when ADR 0047's by-id rule lets the reader ask for it: its item is projected and in a scope the reader may read, or the read filter admits it at the read's time.

**Why.** Dropping is the inspector's shape (`provenance.ts`: "no node, no edge and no count"), and a count would need a schema field. The brief said "through `evaluateRead`"; taken literally that drops every retired version from every lineage, even the owner's, since the filter admits only active items, and breaks version history. A member already sees its scope's events, which name those ids.

**Result.** Over dana's version: dana sees two ancestors, lee one, sam none; an erased id is dropped for all.

**Consequence.** No new ADR: ADR 0047's rule covers it.
