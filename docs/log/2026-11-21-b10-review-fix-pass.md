---
date: 2026-11-21
author: claude-agent
type: change
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/src/recording.ts
  - packages/model/test/proxy.test.ts
  - packages/runner/src/live.ts
  - "make test-one T=packages/model/test/proxy.test.ts"
supersedes: none
---

**What.** Card B10's review fix pass answers findings B10-1 to B10-8 on the cassette proxy.

**Why.** The independent review found two important and six minor gaps, none critical.

**Result.** B10-1: `checkHarnessEndpoint` takes a required `{ port }`. B10-2: a test turns ENGRAM_OFFLINE on after a recording proxy starts and gets a 404 miss with 0 upstream calls. B10-3: a cell header sent twice is a 400, read from `headersDistinct`. B10-4: tests for a 413 and for an endpoint query or fragment. B10-5: a streaming request is a 501 before its cell is read. B10-6: `RESERVED_HARNESSES`. B10-7: the replay test on a `fileCache` with tool calls. B10-8: `recordingRefusal`, moved from the runner into `@engram/model` and used by both. 25 tests pass; six mutations, one per new guard, each failed a test.

**Consequence.** B7 and B11 pass the proxy's port to `checkHarnessEndpoint`, and `repo` when they record into a file cache.
