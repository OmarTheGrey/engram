---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/test/view.test.ts
  - packages/ui/test/provenance.test.ts
  - packages/view/test/package.test.ts
supersedes: none
---

**What.** All four tests of the moved code (`view.test.ts`, `provenance.test.ts`, `twin.test.ts`, `who-can-read.test.ts`) stay in `packages/ui/test/`, unchanged, importing through the re-exports; `packages/view/test/package.test.ts` is new and holds the package's shape instead of a copy of them.

**Why.** The card moves the code "with their tests" but keeps every test a log entry cites at its path; `grep -rlE "packages/ui/test/(view|provenance|twin|who-can-read)" docs/log` finds all four cited, so none can move, and a copy would be two suites to keep in step.

**Result.** The new test checks the one dependency and that every import is `import type` from `@engram/sdk`, that both old paths export the same functions by identity, and the leak rule once from the package.

**Consequence.** If wrong, the four files are copied into `packages/view/test/` importing `../src/`; nothing else changes.
