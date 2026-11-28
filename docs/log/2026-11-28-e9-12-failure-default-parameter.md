---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/policy/consent.test.ts
supersedes: none
---

**What.** A unit test meant to call evaluateWrite with no time passed `undefined` through a helper whose default parameter replaced it with a time, so it failed (`expected 'test/write/person' to be 'engram/write/consent'`).

**Why.** JavaScript applies a default parameter when the argument is undefined.

**Result.** The test now calls evaluateWrite directly; the code was right.

**Consequence.** Nothing.
