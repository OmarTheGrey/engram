---
date: 2026-11-21
author: claude-agent
type: failure
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/distill/episode.test.ts
supersedes: none
---

**What.** On its first run, the parser test "a session without a task or an outcome entry has a null task id and verdict" failed with `InvalidSessionError: entry id a0000005 appears twice`.

**Why.** The bug was in the test. After it filtered out the custom entries, it replaced the line at index 5. The filter had shifted the indexes, so that index held the assistant entry, and the test wrote a second user entry with an id already in use.

**Result.** The test now re-parents the system message at index 3, and all 17 tests pass. The parser's duplicate-id refusal fired as designed.

**Consequence.** Nothing in the code.
