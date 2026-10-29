---
date: 2026-10-29
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/vitest-exit-code.test.ts
  - "FORCE_COLOR=1 pnpm exec vitest run scripts/test/vitest-exit-code.test.ts"
supersedes: none
---

**What.** The hotfix's regression test failed on CI (PR #14) although the exit codes it checks were right.

**Why.** GitHub Actions sets FORCE_COLOR, so the spawned vitest printed colour codes between "Tests" and "1 failed", and the summary pattern did not match. Locally the output was plain.

**Result.** Reproduced with `FORCE_COLOR=1`: both cases failed. The child now runs with `NO_COLOR=1` and `FORCE_COLOR=0`, and its output is stripped of ANSI sequences before matching; both cases pass with `FORCE_COLOR=1`.

**Consequence.** A test that reads another process's output sets that process's colour environment.
