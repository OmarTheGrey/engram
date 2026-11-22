---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/log/chain.test.ts
supersedes: none
---

**What.** After merging main, the migration-order test failed on both backends.

**Why.** It used a stand-in migration with id 6, which collided with E8.12's real migration 6.

**Result.** The test now uses main's real migration 6, writes attestation rows, and shows the attestation gap.

**Consequence.** None beyond the test.
