---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/scale.test.ts
  - packages/runner/src/research/h1-rows.ts
  - "make test-scale"
supersedes: none
---

**What.** The review (RV1-5) found that `make test-scale` could not fail on a whole-file reader: the 540 million characters were split between results.jsonl and events.jsonl, each under V8's limit, and the test reimplemented the script's reader.

**Why.** The test measured the two files together and read results.jsonl with its own copy of the reader.

**Result.** The reader and the row cut moved to `packages/runner/src/research/h1-rows.ts`, which `scripts/h1-sessions.ts` and the test both import. The test adds a single results.jsonl with the plane logs left in, asserts its size is above the limit and that reading it whole throws, and reads it back with the shared reader. With the reader swapped for a whole-file read, the test fails; as built, it passes in 11.6 s.

**Consequence.** The scale test now holds the reader `make h1-table` runs.
