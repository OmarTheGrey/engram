---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/rv1.test.ts
  - "pnpm --filter runner exec vitest run test/rv1.test.ts"
supersedes: none
---

**What.** The first spend-ceiling tests failed for a reason other than the code under test: the run never stopped.

**Why.** The faux "live" provider set each reply's cost in its response factory, but pi-ai's faux provider replaces a reply's usage with its own estimate from the prompt length, which carries no cost, so every call cost 0 USD and no provider ever reached the ceiling.

**Result.** The test's provider now sets the cost on the reply its model collection returns (a wrapper around `completeSimple`), where a live provider reports it; both ceiling tests then passed, and 14 of 14 in the file.

**Consequence.** A test that needs a call's cost sets it after the faux provider answers, as `scriptedAnswers` already zeroes it there.
