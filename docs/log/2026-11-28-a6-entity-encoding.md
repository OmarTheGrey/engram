---
date: 2026-11-28
author: claude-agent
type: decision
card: A6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mcp-memory/index.ts
supersedes: none
---

**What.** An item the plane writes is one entity line named `engram:<id>`, of type `engram`, with no observations and the whole item under one extra member `engram`; the content is never written as an observation.

**Why.** The server keeps members it does not model on every rewrite (its 2.0.1 change) and never returns them from a tool, so its own read tools show the name and nothing of the content: what an item says reaches a model only through the plane. Writing the content as an observation would let `read_graph` and `search_nodes` serve it ungoverned.

**Result.** A server rewrite (the test double) leaves the adapter's line byte for byte and every item reads back whole; the server sees each item as an entity with no observations.

**Consequence.** A user of the server's own tools sees opaque `engram:<id>` entities and none of their content.
