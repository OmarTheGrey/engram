---
date: 2026-10-22
author: omar
type: failure
card: S0.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/suite.ts
  - "git show 7515b0d"
supersedes: none
---

**What.** The S0.11 commit was made and pushed while `make lint` failed on a TypeScript error in the conformance suite.

**Why.** The command chain ran lint, tests and the commit in sequence without stopping on the lint exit code; the tests passed, so the commit went through.

**Result.** The base fixture was typed as the whole MemoryItem union, so spreading it with new string content did not type-check. Commit 7515b0d typed it as a knowledge item; `make lint` passed afterwards.

**Consequence.** Commits are chained on `make lint && make test`, so a failing gate stops the commit; CI would also have caught it.
