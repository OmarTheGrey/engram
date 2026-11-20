---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/race.test.ts
  - packages/runner/test/b3.test.ts
supersedes: none
---

**What.** The fix pass's first `make test` failed: 57 tests in 20 files, among them the Letta adapter suites, the CLI's doctor and Letta tests, six runner command tests, and one dogfood report script test.

**Why.** Load from the other agents' runs on this machine. 44 failures were timeouts (30 s to 300 s), and the rest were Letta repository locks held by a sibling test process, plus EPERM and EBUSY errors cleaning up temp folders. None of these files touch adoption or offboarding.

**Result.** Each failing file was rerun on its own with the same code at `264d8a5` and passed: adapters 303, CLI 92, runner 78 (one B3 timeout, which passed alone with 11 of 11), and core's dogfood report 44.

**Consequence.** No code change. A clean full run needs a quieter machine.
