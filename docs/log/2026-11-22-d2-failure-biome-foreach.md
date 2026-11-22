---
date: 2026-11-22
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/test/induce.test.ts
  - "pnpm exec biome check --error-on-warnings ."
supersedes: none
---

**What.** `make lint` failed on the fix pass's runner test with biome's `useIterableCallbackReturn`.

**Why.** A `forEach` callback written as an arrow expression returned `expect(...)`'s value, and the test file was formatted but not linted before its commit.

**Result.** Commit `7cd95803` uses a `for` loop. `make lint` passes; its one remaining info is in `packages/pi-extension/test/harness.ts`, from main.

**Consequence.** None.
