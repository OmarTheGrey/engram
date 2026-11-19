---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Verification finding V-10: the purge's refusal said the record is deleted even when the store refused the delete.

**Why.** The reason was written before the delete ran.

**Result.** The refusal now says the plane deletes the record, and a failure is one store-failure deny saying how (V6, V7).

**Consequence.** None.
