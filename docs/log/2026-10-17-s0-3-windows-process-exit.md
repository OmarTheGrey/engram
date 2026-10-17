---
date: 2026-10-17
author: omar
type: failure
card: S0.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/check-pr.ts
  - "make lint-docs PR=fixtures/ci/pr-no-log"
supersedes: none
---

**What.** On Windows, the check scripts crashed with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, `src\win\async.c`) when they called `process.exit(1)` straight after writing problems to stderr.

**Why.** `process.exit` tears the process down while the stderr pipe write is still pending; the scripts ran under make, whose stderr is a pipe.

**Result.** The gate still failed, but with exit code 127 and a crash message instead of exit code 1. Setting `process.exitCode` and returning lets the write finish; the same run now exits 1 with only the problem line.

**Consequence.** Scripts in this repository set `process.exitCode` and never call `process.exit` after writing output.
