---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/grants.test.ts
supersedes: none
---

**What.** Review finding M5 of PR #44: the grant-change property had no coverage guards, so it could pass while never generating an allowed change or some refusal.

**Why.** It checked agreement with the oracle on whatever it drew.

**Result.** Guards now require allowed changes, the hidden refusal and each deny rule (owner, source, status, unchanged, expired, write gate); the generator draws grants of the item's class so allowed changes are common.

**Consequence.** None.
