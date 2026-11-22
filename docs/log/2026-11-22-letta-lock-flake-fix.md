---
date: 2026-11-22
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "packages/adapters/src/lock.ts"
  - "packages/adapters/test/letta/letta.test.ts (the wait bounds one holder, not the writers before it)"
  - "for b in $(seq 1 7); do for l in 1 2 3 4; do pnpm exec vitest run packages/adapters >/dev/null 2>&1 & done; for k in $(seq 1 8); do (pnpm exec vitest run packages/adapters/test/letta/repository.test.ts -t \"four openers\" >/dev/null 2>&1 && echo pass || echo FAIL) & done; wait; done | sort | uniq -c"
supersedes: none
---

**What.** The shared store lock restarts a waiter's wait at each new acquisition (another instance's token or a new start time), so it refuses only when one holder keeps it for `lockWaitMs`.

**Why.** The M-2 flake (finding, 2026-11-22).

**Result.** Three tests drive the lock's clock seam. Three holds in turn, each under the wait, by three instances or by one (M-2's pattern): refused in 439 ms before the fix, written after; the one-instance row fails if only tokens are compared. A holder kept past the wait: still refused, naming it; with the refusal disabled it fails within two polls. The loop above (eight M-2 runs beside four adapters runs, per batch): before, 12 of 16 failed (13.9 to 17.6 s); after, 0 of 56 (16.0 to 22.2 s). Lighter load: before, 4 of 8 then 0 of 24 failed; after, 0 of 52.

**Consequence.** M-2 stops flaking, its test unchanged.
