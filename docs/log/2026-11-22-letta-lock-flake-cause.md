---
date: 2026-11-22
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "packages/adapters/test/letta/repository.test.ts (M-2: four openers race to initialise it; every one opens and every write lands)"
  - "packages/adapters/src/lock.ts"
  - "packages/adapters/test/letta/letta.test.ts (the wait bounds one holder, not the writers before it)"
supersedes: docs/log/2026-11-19-rv3-review-failure-make-test-under-load.md
---

**What.** The M-2 flake is the store lock refusing a write, not load alone; this corrects `docs/log/2026-11-06-px2-failure-letta-race-under-load.md`, `docs/log/2026-11-19-b6-failure-letta-race.md` and RV3's entry.

**Why.** Every failure read `.git\engram.lock is held by pid ...`. The lock is not fair: an instance releasing it with a write queued retakes it before a waiter polls. Three probes logged `I2 I2 I2 I2 I2 I4 I4 I4 I4 I4 I3 ...`: the last instance waits through fifteen holds, past the 10 s wait once load slows writes to about 0.6 s. B6's EBUSY follows from the refusal: a teardown `rmdir` of the same `memory` folder while the other instances' writes still run git there, in 15 of 16 failing runs and none of 152 passing.

**Result.** A test on the lock's clock seam fails the same way before the fix.

**Consequence.** Fixed in the shared lock (change entry, 2026-11-22).
