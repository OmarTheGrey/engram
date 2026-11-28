---
date: 2026-11-28
author: claude-agent
type: change
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.test.ts
  - docs/conventions/testing.md
supersedes: none
---

**What.** Card E0.7's review fixes: the scanner reads a `/` after `x!`, `x++` and `x--` as a division; the rule refuses computed, destructured and `globalThis` forms, `Date` as a value, a bare `hrtime`, `Temporal.Now` and an argument-free `DateTimeFormat(...).format()`; the guard refuses `Resolver` instances, names under `.localhost`, a connection's own `lookup` and a UNC path to a host, and lets an IP literal lookup through.

**Why.** The independent review's findings 1 to 5 and 7; finding 1 hid a clock call in ordinary strict TypeScript.

**Result.** The rule has 66 tests (29 new) and the guard 22 (6 new), all passing under the variable. Mutants killed: dropping the `!`/`++`/`--` branch failed the four division probes; dropping the Resolver patch and the literal pass failed their two tests. The core tree stays clean.

**Consequence.** `docs/conventions/testing.md` and C44's limits name what a text rule and the guard cannot see.
