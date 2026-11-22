---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_vendor_amsb.py
  - packages/bench/scripts/vendor-amsb.py
  - "ENGRAM_OFFLINE=1 uv run pytest research/tests/test_vendor_amsb.py"
supersedes: none
---

**What.** Two tests added for review finding X14-4 failed under `ENGRAM_OFFLINE=1`, and the fix pass reported them passing.

**Why.** `fetch()` refuses a missing file offline before it calls the download it was given, so a test with a faked download never reached it; the tests were run only with the variable unset, never the way CI runs them (review finding X14-6).

**Result.** Under `ENGRAM_OFFLINE=1`: 2 failed, 2 passed. After the fix, the two tests clear the variable (their download is faked, so no network is used) and a new test sets it and shows the real downloader refused: 5 passed with the variable at 1, at 0 and unset.

**Consequence.** A test of code that reads `ENGRAM_OFFLINE` is run with it set before it is reported passing.
