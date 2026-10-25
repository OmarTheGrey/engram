---
date: 2026-10-25
author: claude-agent
type: change
card: E1.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/replay.ts
  - packages/core/test/replay/items-at.test.ts
  - "pnpm --filter core exec vitest run test/replay/items-at.test.ts"
supersedes: docs/log/2026-10-25-e1-3-replay-at-seq.md
---

**What.** Corrects the mutation claim in the card E1.3 entry: changing the bound in `itemsAt` from `<=` to `<` fails three of the four replay tests of that card, not all four.

**Why.** Review finding R2-4 on PR #2. The test "a seq past the end of the log is the current set" still passes under the mutant, because a bound past the end admits every event either way.

**Result.** Rerun on branch fix-pr1 with the mutant applied: of the six tests now in `items-at.test.ts`, five fail and that one passes; the two added by the review fix pass (the hand-written oracle and the store_ref property) both fail.

**Consequence.** Nothing changes in the code; the rest of the superseded entry stands.
