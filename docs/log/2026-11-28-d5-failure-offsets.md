---
date: 2026-11-28
author: claude-agent
type: failure
card: D5
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/lint/procedural.test.ts
supersedes: none
---

**What.** The first run of the acceptance test failed two of 102 tests.

**Why.** The test's expected end offset of the fetch-pipe-shell finding was 59, counted by hand; the body is 51 characters long, and the scan reported 51.

**Result.** The expectation was corrected to 51, the code unchanged; 102 pass.

**Consequence.** None.
