---
date: 2026-11-07
author: claude-agent
type: failure
card: B5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/cli/test/doctor-review.test.ts
  - "pnpm exec vitest run packages/cli/test/doctor-review.test.ts"
supersedes: none
---

**What.** After the LongMemEval fixture was vendored, `doctor-review.test.ts` "fails when a fixture directory has no manifest.json" failed: its `mkdir` of `fixtures/bench/longmemeval` threw because the directory exists.

**Why.** The test copies the repository's `fixtures/bench` and then made a bare `longmemeval` folder as its example of a pinned benchmark with no vendored fixture, which stopped being true with card B5.

**Result.** The example is now `merit` (MERIT is pinned and has no vendored fixture); the test checks the same behaviour and passes.

**Consequence.** Card B7 (MERIT) moves the example again when it vendors a fixture.
