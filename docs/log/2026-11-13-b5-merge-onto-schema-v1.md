---
date: 2026-11-13
author: claude-agent
type: failure
card: B5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/longmemeval/plane.ts
  - research/configs/b5-longmemeval-plane.json
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b5-longmemeval-plane.json"
supersedes: none
---

**What.** After main (schema version 1, PR #29) reached the B5 branch through the updated `@engram/model` branch, the offline B5 replay failed on its first C5 call: no cassette for its key.

**Why.** The LongMemEval plane writer built items at schema version 0, which version 1 refuses, so every C5 write was denied and the reader's prompt held no memory, a prompt no cassette had recorded. tsc caught the same line.

**Result.** The writer now builds version 1 items. The replay makes 0 new model calls and 72 from cassettes over 24 sessions, with the committed cassettes unchanged. Bench, runner, model, doctor-review and scripts tests pass.

**Consequence.** No cassette was re-recorded; PR #37 merges after PR #36.
