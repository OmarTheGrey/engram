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
supersedes: none
---

**What.** The M-2 flake, failing `make test` after 11 to 12 s, is the store lock refusing a write, not load alone.

**Why.** Under parallel load every failure read `.git\engram.lock is held by pid ...`, from `src/lock.ts`. The lock is not fair: an instance releasing it with a write queued takes it again before a waiter's next poll. A probe logged the commit order `I2 I2 I2 I2 I2 I4 I4 I4 I4 I4 I3 ...` in three runs of three, so the last instance waits through fifteen holds: about 2 s idle (142 ms a write), past the 10 s wait, which bounded the whole queue, once load slows writes to about 0.6 s. RV3's failure entry of 2026-11-19 called this refusal load.

**Result.** A test on the lock's clock seam fails the same way before the fix.

**Consequence.** Fixed in the shared lock (change entry, 2026-11-22).
