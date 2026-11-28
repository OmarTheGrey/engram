---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/keys.test.ts
supersedes: none
---

**What.** The keys test failed when both new commands became Home rows: at 120x40 Home said "3 more below".

**Why.** Home was exactly full (finding home-full).

**Result.** Resolved by decision home-rows; the test asserts every Home row fits and names the two entries left to the hook screen.

**Consequence.** Nothing further here.
