---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/provenance.ts
  - packages/ui/test/provenance.test.ts
supersedes: none
---

**What.** An id a lineage names becomes a node only when the server gave the viewer that item's state (in its read, or carried by a visible event) or an allowed write or promotion of it among its events; nothing says an ancestor was left out.

**Why.** The card left open what counts as an ancestor the viewer may see, and the inspector may not decide policy (rule 1).

**Result.** The rule only selects from what visibleEvents and Plane.read already gave; an id only a lineage, a denied write or a read's ids names is not shown. Reads are not graph nodes; descendants are.

**Consequence.** If wrong (too strict), an owner sees no node for a retired ancestor whose write it saw only as withheld; it shows as content not shown.
