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
  - "ENGRAM_OFFLINE=1 uv run pytest research/tests/test_vendor_amsb.py research/tests/test_redteam.py"
supersedes: docs/log/2026-11-21-x14-review-fixes.md
---

**What.** The review fix pass of card X14, findings X14-1 to X14-6, restated: the earlier entry said the vendor tests pass, which held only with the network allowed.

**Why.** Verification found two of the four vendor tests failing under `ENGRAM_OFFLINE=1`, as CI runs (finding X14-6).

**Result.** X14-1: scope isolation tested under medium on both routes and by an order test; the reviewer's mutation fails two tests. X14-2: upstream's defended-critical test ported, the dropped `categories` field named. X14-3: an attack with a blank canary refused (4 tests). X14-4: `vendor-amsb.py` refuses bytes that differ from the vendored hashes. X14-6: the two tests with a faked download clear `ENGRAM_OFFLINE`, and a fifth shows the real downloader refused offline; 19 tests pass with `ENGRAM_OFFLINE` at 1, at 0 and unset. X14-5: a decision entry. The result's bytes did not change.

**Consequence.** None for the table.
