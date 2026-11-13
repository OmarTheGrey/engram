---
date: 2026-11-13
author: claude-agent
type: finding
card: L1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/lint/det.test.ts
  - "pnpm exec vitest run packages/core/test/unit/lint/det.test.ts"
supersedes: none
---

**What.** The review of PR #38 found that `Plane.lint` judged a finding's other items by `reachable`, which counts a grant that has expired or names another class.

**Why.** For an item in a readable scope citing a source the actor could reach only by such a grant, source-changed showed the source's current strict content hash and orphan its retirement policy, though `Plane.read` would never admit that source. A hash of short content can be confirmed by guessing.

**Result.** A new test (source reached by a live grant, by an expired grant, and by none) failed on the branch head, showing the hash; with `canReach` built on the new `readableAt` (scope or `liveGrants`, shared with `evaluateRead`) the expired case equals the no-grant case. 37 lint tests, 796 core unit, replay and invariant tests pass.

**Consequence.** ADR 0009 amended; see `docs/log/2026-11-13-l1-decision-lint-live-grants.md`.
