---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: none
---

**What.** A withdrawal or a narrowing writes the item at one above its current version.

**Why.** Versions must not repeat for the plane's own changes (V-8).

**Result.** V3 checks versions never fall and recovery always raises them; restoring the old maximum fails it.

**Consequence.** None.
