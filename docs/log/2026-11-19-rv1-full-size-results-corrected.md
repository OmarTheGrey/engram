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
  - "make test-scale"
supersedes: docs/log/2026-11-19-rv1-full-size-results.md
---

**What.** `make test-scale` now also writes one results.jsonl above V8's string limit and reads it back with `make h1-table`'s own reader (review RV1-5).

**Why.** The earlier entry's case split the rows between two files, each under the limit, so it showed the writer but not the reader.

**Result.** The split case (26,616 rows through the journal, events in events.jsonl, resumed at 26,616 sessions and converted) and the single-file case pass together in 11.6 s; a whole-file reader fails the test.

**Consequence.** None beyond the test.
