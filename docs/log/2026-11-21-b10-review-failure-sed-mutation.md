---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
supersedes: none
---

**What.** One of the fix pass's six mutation checks did not run at first: its sed expression (`0,/pattern/{//}`) was malformed, so the file was unchanged and all 25 tests passed.

**Why.** GNU sed refused the address form, and the loop went on to run the tests on unmutated source.

**Result.** Rerun with a line-addressed sed on the streaming pre-check, the mutation failed the streaming test, and the source was restored (cmp against the saved copy).

**Consequence.** A mutation loop checks that the file changed before trusting a pass.
