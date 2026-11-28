---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/core/src/plane/explain-absent.ts
  - packages/core/test/property/explain-absent.test.ts
supersedes: none
---

**What.** The answer explains the read with the same query over the projection as it stands, before the sweep and adoption a read with a store runs first; the route, the CLI and MCP run neither.

**Why.** The card says no event is written, and the owner's sweep and adoption each append events.

**Result.** For the store's owner the answer can differ from the read that follows: an item past its ttl answers `ttl` where that read, after its sweep, counts it not active (`status`); a store record not yet adopted answers as an unknown id; an edited record is matched on the content the plane holds. The module comment, the route summary, the CLI help and AGENTS.md say so (review finding E2.17-1). The fixture test checks reads just before the sweep, where past-ttl items answer `ttl`.

**Consequence.** A caller who wants the post-sweep answer reads first, then asks.
