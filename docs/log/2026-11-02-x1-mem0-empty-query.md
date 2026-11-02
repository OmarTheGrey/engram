---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/adapters/src/mem0/index.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** The Mem0 adapter's search returns no item for an empty query, where the fake and Letta adapters return every item and the plane's read returns every admitted item.

**Why.** Card B4's scripted MEM-INV-Bench model reads memory with an empty query, as upstream shows the model its whole memory; on Mem0 the ungoverned conditions would then see no memory while C5 saw all of it.

**Result.** A one-off script on two items in two scopes, with the runner's Mem0 configuration (hashing embedder, threshold 0.1), returned 0 items for `""` and 2 for `"Acme"` and for `"pay the acme invoice"`; the script was not kept.

**Consequence.** The ungoverned read lists every item when the query has no terms (the next entry); a live model's own queries still meet Mem0's semantic search.
