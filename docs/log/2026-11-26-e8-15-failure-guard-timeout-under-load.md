---
date: 2026-11-26
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
supersedes: none
---

**What.** The pre-merge `make test` of `cliupgrade` at `458b3519` failed 5 of 6,738 tests. One was the no-policy guard's "fails each of the verification's five gaps (N2)", which timed out at 72 seconds against its 60-second limit. The other four were Letta and replay tests: two git crashes with Windows start-up codes, one git "dubious ownership" refusal on a temp repository, and a 31-second replay timeout.

**Why.** The machine was loaded: a verifier ran beside the suite. Run alone, all five files passed, and the guard file took 23 seconds.

**Result.** The guard's three compile-heavy tests now allow 300 seconds each, where before they allowed 60 or 120. The Letta and replay failures need no change.

**Consequence.** A loaded machine no longer fails the guard. A second full run follows before the merge.
