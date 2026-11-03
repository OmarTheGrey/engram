---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - "make test"
supersedes: none
---

**What.** `make test` failed twice on this round's head: `packages/runner/test/b3.test.ts` found an `engram-runner-letta-*` folder in the temp directory that was not there before its run. Every one of its tests passed the first time; the second time one acceptance test failed the same check.

**Why.** The check compares the shared system temp directory before and after. Other agents' test runs on the same machine created their own Letta folders meanwhile. Each flagged folder was gone moments later, so none was this run's leak. The only runner source changed since `6d13e25` is comments.

**Result.** With `TEMP` and `TMP` set to a private folder, `make test` passes: vitest 139 files, 2,562 passed and 15 skipped; pytest 199.

**Consequence.** Run the suite with a private temp folder when other runs share the machine, or the check should look only at its own folders.
