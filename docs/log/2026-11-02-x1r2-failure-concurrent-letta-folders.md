---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - "pnpm exec vitest run packages/runner/test/b3.test.ts"
supersedes: none
---

**What.** One `make test` run of the round-2 fix pass failed in `b3.test.ts`: its check that every Letta repository a probe opens is removed found a new `engram-runner-letta-*` folder in the system temp directory.

**Why.** Another worktree on the same machine (PR 2's verifier) started `vitest run` at 20:29, during this run, and its Letta tests create folders with the same prefix; the check lists the whole temp directory, not the folders its own probes made. The folder was gone a minute later.

**Result.** Run alone after the other run ended, `b3.test.ts` passes (9 tests), as it did in the earlier full run; the full suite was run again.

**Consequence.** Two test runs on one machine at once can fail this check; it is card B3's test and is left as it is here.
