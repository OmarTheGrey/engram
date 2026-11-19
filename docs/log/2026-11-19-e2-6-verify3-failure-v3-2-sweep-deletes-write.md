---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** Finding V3-2: with two offboardings overlapping, the earlier one's sweep deleted a write the owner committed after the later report, and appended a swept event for it.

**Why.** The sweep decided on its listing and deleted without checking the record's item under the lock afterwards.

**Result.** Probe Q1 failed before the fix and passes after.

**Consequence.** See the decision on the sweep's protocol.
