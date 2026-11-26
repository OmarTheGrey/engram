---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/review.test.ts
  - packages/cli/test/tui/frames.test.ts
  - packages/cli/src/tui/log-check.ts
supersedes: docs/log/2026-11-22-e8-15b-change-review-fix-pass.md
---

**What.** The review fix pass, restated with one number corrected and the verification's five items added: the reviewer's high-contrast mutation (a denial drawn as reverse video) fails 2 frame tests, not 3 as the earlier entry said. The verification then fixed a log check that outlived quitting (27), first run's stale log answer while a URL is typed (28), the help key cut off the hints row at 80 columns (29), and an untested ctrl+c fast path (30).

**Why.** The verifier drove the fixed branch in a real terminal and counted the mutation's failures.

**Result.** `make test-one T=packages/cli/test/tui/review.test.ts`: 27 passed; entry 19, keys 21, saved 11, frames 88. Disabling the ctrl+c fast path now fails test 30.

**Consequence.** The earlier entry's other numbers stand.
