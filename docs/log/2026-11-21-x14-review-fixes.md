---
date: 2026-11-21
author: claude-agent
type: change
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/redteam/run.test.ts
  - packages/bench/test/redteam/corpus.test.ts
  - research/tests/test_redteam.py
  - research/tests/test_vendor_amsb.py
  - "make redteam"
supersedes: none
---

**What.** The review fix pass of card X14: findings X14-1 to X14-5.

**Why.** The review found the scope-isolation test ran only the store setting (a reader made a member of `team:rt-1` passed all 32 tests), and four minor gaps.

**Result.** X14-1: isolation is tested under medium on both routes and by an order test; the reviewer's mutation now fails two tests. X14-2: upstream's defended-critical test is ported and the dropped `categories` field named in `docs/absorbed.md`. X14-3: an attack with a blank canary is refused (4 tests). X14-4: `vendor-amsb.py` refuses a download or an earlier file that differs from the vendored hashes (4 tests). X14-5: a decision entry. The result's bytes did not change.

**Consequence.** None for the table.
