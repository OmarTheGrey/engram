---
date: 2026-11-22
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/supersede-leak.test.ts
  - packages/server/test/supersede.test.ts
supersedes: none
---

**What.** The plan of L6, as first handed in, disclosed and could rewrite items the read filter refuses (L6-1, critical). Three important findings came with it: an untested rule (L6-2), an internal error on a read-only store (L6-3) and an incomplete finding (L6-4).

**Why.** The core commit filtered by `readableAt`. The takeover reviewed the route but not that filter, and no test asked about a non-active item.

**Result.** The reviewer's probe showed candidate and expired content in `submitted`, and a candidate rewritten as version 2. Both tests now fail on the old code.

**Consequence.** Visibility in any new view is now tested against items the read filter refuses, not only items out of scope.
