---
date: 2026-10-28
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/apply-event.test.ts
  - packages/core/test/replay/items-at.test.ts
  - packages/core/src/events.ts
  - "pnpm exec vitest run packages/core"
supersedes: docs/log/2026-10-25-pr1-review-fixes.md
---

**What.** Corrects one count in the log entry for the PR #2 review fix pass: removing the decision guard of `applyEvent` fails 12 tests, not 11.

**Why.** The round 2 verification of PR #2 (finding N4) measured 12 at commit a2dbdb8: 10 `applyEvent` unit tests, the hand-written fixture oracle, and the store_ref property test, which the earlier entry did not count.

**Result.** Measured again on branch r2-pr1 by deleting the line `if (event.decision !== "allow") return before;` in packages/core/src/events.ts: 12 failed, 108 passed, the same 12 tests. Everything else in the superseded entry stands.

**Consequence.** Nothing in the code; the earlier entry stays as written.
