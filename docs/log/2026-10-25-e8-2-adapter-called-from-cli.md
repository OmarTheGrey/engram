---
date: 2026-10-25
author: claude-agent
type: failure
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/store.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** The first `engram read` showed no fixture memory, and the first fix listed the folder through the adapter from the CLI and wrapped the adapter to return existing store_refs.

**Why.** The read path takes candidates from the projection (card E2.2), which holds only items the plane wrote; Claude Code's own files never entered it.

**Result.** The orchestrator rejected the fix: a surface calling an adapter breaks AGENTS.md rule 2 and puts plane behaviour outside core. Adoption moved to `adoptStoreItems` in core and the CLI wrapper was deleted.

**Consequence.** Surfaces bring existing store content under the plane only through core.
