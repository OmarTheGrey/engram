---
date: 2026-11-25
author: claude-agent
type: finding
card: L8
chapter: limitations
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/test/unit/lint/near-duplicate-presets.test.ts
supersedes: none
---

**What.** What would change if the registered call sites dropped `reach: "scope-registered"` after the tag.

**Why.** The lead decides whether H3 moves to the filtered reach.

**Result.** The H3 MANIFEST rows would not change: under the default, h3-fault-set, h3-lint-floor, h3-near-duplicate and h3-lint-nli reproduced their sha256. The changes would fall on near-duplicate-presets.test.ts's pinned report hashes: under each of the strict and medium presets, 21 of 34 fixture runs change. Most change only in wording: an orphan reads "names no active item you can reach" in place of "names an item retired by engram/retention/item-ttl". The (lint, item) findings change in orphan.flag.json under both presets, where the source-changed finding on a retired source goes, and in base state dfde3500 under strict.

**Consequence.** Collapsing to one reach later means re-pinning that test's four hashes, and nothing in research/results.
