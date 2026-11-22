---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/plane.ts
  - packages/core/src/distill/validate.ts
  - packages/core/test/unit/plane/promote-replay.test.ts
supersedes: docs/log/2026-11-21-d3-finding-induced-from-check.md
---

**What.** The plane checks a replay's induction tasks against the candidate's own distill ref through a session index injected into its deps (`PlaneDeps.distillTasks`), not task ids carried in the ref (review finding D3-3).

**Why.** The ref names sessions, and core holds no session index. Carrying task ids in the ref would change card D2's ref format while D2's review is still changing it.

**Result.** An empty `induced_from` against a ref naming t1, with t1 replayed, is denied `engram/promote/replay-split`. So is a ref the index cannot map, and any ref when no index is given. Cherry-picking held-out tasks stays open until the lead fixes n (lead question D3-1).

**Consequence.** Every caller of `Plane.promote` with a replay must inject card D1's index (the runner does). If wrong, a later schema card could move task ids into the ref instead.
