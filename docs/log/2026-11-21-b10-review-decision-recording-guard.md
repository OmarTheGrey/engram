---
date: 2026-11-21
author: claude-agent
type: decision
card: B10
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/model/src/recording.ts
  - packages/model/src/proxy.ts
  - packages/runner/src/live.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** The runner's live-cassette guard moves into `@engram/model` as `recordingRefusal` (`packages/model/src/recording.ts`). The runner's live mode and the proxy both call it. `fileCache` now names its folder (`CacheStore.dir`).

**Why.** Review B10-8: in record mode the proxy did not apply the runner's live guard. Reusing the guard from the runner would cross ADR 0033's import boundary, so the check moved to the package both import.

**Result.** The runner's refusal messages are unchanged and its live tests pass. The proxy needs `repo` to record into a file cache, refuses `fixtures/`, a committed folder and any folder inside the repository but not under `.engram/`, and with `recordFixtures` (for `make fixtures`) records into `fixtures/` only. A memory cache writes no file and is not checked; replay is never checked.

**Consequence.** A custom CacheStore that writes files without naming `dir` escapes the guard.
