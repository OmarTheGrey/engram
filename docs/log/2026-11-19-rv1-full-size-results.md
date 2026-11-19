---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/scale.test.ts
  - packages/runner/scripts/h1-sessions.ts
  - "make test-scale"
supersedes: none
---

**What.** GateMem's plane log moved out of results.jsonl into events.jsonl (one line per row, same order), every results file is written and read one line at a time, and `make h1-table` reads a run's rows that way (review finding RV-EXP-2).

**Why.** At the full set's means (146.8 writes per C5 checkpoint at about 374 characters an event, about 68 items per C4 checkpoint) the review estimated 26,616 rows at 539,938,830 characters, past V8's string limit of 536,870,888, so the old writer would have thrown after every call was paid for, and `h1-sessions.ts` read the file as one string.

**Result.** `make test-scale` writes 26,616 synthetic rows at those sizes through the journal, reads them back, resumes the folder at 26,616 sessions and converts them into H1 sessions: 1 test passed in 22.0 s.

**Consequence.** It runs outside `make test`, since it writes half a gigabyte.
