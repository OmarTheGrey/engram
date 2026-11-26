---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/frames.test.ts
supersedes: docs/log/2026-11-22-e8-15b-change-review-fix-pass-corrected.md
---

**What.** The high-contrast test now checks the denial's symbol as well as its word, and the count of the reviewer's mutation is restated by which mutation is run.

**Why.** Rechecking the corrected entry's count: a mutation of the symbol alone (`return reverse(s)` for a denial) failed only the 2 denied high-contrast snapshots, and the explicit test, which read the word's cells only, passed it. Reversing the symbol and the word failed 3. So the 2 the verifier counted and the 3 of the first entry were both right, for different mutations.

**Result.** `make test-one T=packages/cli/test/tui/frames.test.ts`: 88 passed. Each mutation, of the symbol alone or of the symbol and the word, now fails 3 tests: the two snapshots and the explicit check.

**Consequence.** A mutation of high contrast's denial fails a check that is not a snapshot.
