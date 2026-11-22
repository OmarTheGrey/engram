---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/index.ts
  - packages/core/src/model.ts
supersedes: none
---

**What.** tsc refused the index: model.ts already exports a canonicalJson.

**Why.** The chain's canonical function was first named canonicalJson.

**Result.** Renamed chainCanonical; tsc is clean.

**Consequence.** None beyond the name.
