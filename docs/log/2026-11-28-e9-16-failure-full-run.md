---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/frames-surfaces.test.ts
supersedes: none
---

**What.** `vitest run --update <file>` with an absolute path ran the whole workspace suite (8050 tests) in the background instead of the one file, against the load rule; it updated the 24 intended frames and reported 1 failure whose name the piped output did not keep.

**Why.** The path filter did not apply to that invocation; the output was filtered to its summary lines.

**Result.** The core project (3734 passed) and the CLI project were then run on their own and pass; the unnamed failure did not recur in either.

**Consequence.** Use `--project` with a file filter, and keep full output, for an update.
