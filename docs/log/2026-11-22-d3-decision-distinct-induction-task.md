---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - fixtures/distill/d3-validate/tasks.json
  - packages/runner/test/d3-validate.test.ts
supersedes: none
---

**What.** For review finding D3-8, the induction task `synthetic/bump-timeout-06` gets its own starting repository, and the held-out `synthetic/bump-timeout-16` keeps the one its sessions ran on. The runner now refuses a held-out task whose prompt and start state equal those of an induction task in the pool.

**Why.** Task 06 is never replayed, so changing it moves no cassette. The coordinator asked that nothing be re-recorded before D2's next merge.

**Result.** The refusal fired on the old fixture ("held-out task synthetic/bump-timeout-16 has the prompt and start state of synthetic/bump-timeout-06"). `make test-one T=packages/runner/test/d3-validate.test.ts`: 14 passed.

**Consequence.** At the re-record after D2, task 16 may also get a repository of its own.
