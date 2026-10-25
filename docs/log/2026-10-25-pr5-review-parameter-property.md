---
date: 2026-10-25
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/py.ts
  - packages/bench/test/gatemem/run.test.ts
  - docs/log/2026-10-25-b1-parameter-property.md
supersedes: none
---

**What.** The first version of `py.ts` declared `PyInt` and `PyFloat` with TypeScript parameter properties, and `make bench` crashed with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX.

**Why.** Node runs the bench script by type stripping, which cannot strip parameter properties; vitest transforms them, so every unit test passed and only the spawned `run.test.ts` failed. The same failure was logged once already for card B1.

**Result.** The two classes assign their fields in the constructor body; `run.test.ts` and `make bench BENCH=gatemem` pass.

**Consequence.** A lint rule against parameter properties outside test files would catch this before a spawned test does; not added in this pass.
