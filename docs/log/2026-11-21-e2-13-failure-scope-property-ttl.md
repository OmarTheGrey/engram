---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/who-can-read.test.ts
supersedes: none
---

**What.** The first run of the scope property failed: a scope's answer admitted an actor `evaluateRead` refused.

**Why.** A test fault, not a plane fault. The property meant an open item, and cleared the item's own ttl, but the generated policy's retention rules still gave it a ttl of one second or a day, so it had expired at the read time.

**Result.** The property now draws the policy without retention rules; it passes 400 runs. The scope answer stays the read matrix's alone, which is correct: a ttl closes items, not scopes.

**Consequence.** Nothing in core changed.
