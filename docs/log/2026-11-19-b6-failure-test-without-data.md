---
date: 2026-11-19
author: claude-orchestrator
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/test/b6.test.ts
  - packages/runner/src/count.ts
supersedes: none
---

**What.** One of B6's tests failed in every clone that lacks the LongMemEval data, so `make test` failed on main after PR #51 merged.

**Why.** When the data is absent, the test expects the count to say how to fetch it. Its pattern was `h2_longmemeval_ttl.py --fetch-only`, but the message that `packages/runner/src/count.ts` writes names the config between the two (`--config research/configs/h2-longmemeval-ttl.json --fetch-only`). Every run during B6's work and review had the data on disk, so the other branch of the test was never exercised.

**Result.** The pattern now matches the whole command. The PR #50 verifier found the failure in a fresh worktree.

**Consequence.** A test with a branch that depends on data should be run once without the data before merge.
