---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
supersedes: none
---

**What.** After the property test kept the chain on an attesting handle, the tamper "a manifest placed before the event it names" was caught by `links` instead of `commitments`.

**Why.** The tamper appended its forged erase event through the raw handle, which no longer kept the chain, so the manifest's adjacency rule fired first.

**Result.** The tampers now run through the keeping handle, as a writer with the code would; all 29 are caught by the check each names.

**Consequence.** nothing
