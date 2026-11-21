---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/cached.ts
  - "make lint"
supersedes: none
---

**What.** The first `make lint` failed on biome's unused-import warning for `ModelCall` in `packages/model/src/cached.ts`.

**Why.** Making `cached()` generic removed its last use of the type.

**Result.** The import was removed; biome then reported no warning in this card's files.

**Consequence.** None.
