---
id: repo-stryker-js
title: StrykerJS mutation testing, with mutmut for Python
authors: Stryker team; mutmut by Anders Hovmoller
venue: open-source tool
year: 2026
tier: new
topics: [methods, testing, mutation]
engram: [plane, H1, H4]
code: https://github.com/stryker-mutator/stryker-js (Apache-2.0, 3404 stars, pushed 2026-11-21, v10.1.1), https://github.com/boxed/mutmut (BSD-3-Clause, 1550 stars, pushed 2026-11-19); verified with gh api
sources_read: [https://github.com/stryker-mutator/stryker-js, gh api of packages/vitest-runner/package.json]
---

## Claim
Mutation testing measures whether tests fail when code is broken; a mutation score on the policy and plane files turns "100 percent branch coverage" into evidence that the invariants catch gate regressions.

## Method
Stryker instruments source, runs the suite per mutant (arithmetic, conditional, string, block removal), and reports killed, survived, timeout. `@stryker-mutator/vitest-runner` 10.1.1 declares a peer of vitest >=2.0.0, so vitest 5.0.5 is in range on paper; not run here. Incremental mode, `mutate` globs and `thresholds: {high, low, break}` make it gateable.

## Key numbers
- None measured by us. The repo's log already holds manual mutation checks (a2-surviving-mutations, a2-r2-11-mutation-survived), so the team finds survivors by hand today.

## What Engram borrows
A `stryker.config.json` scoped to `packages/core/src/policy/**` and `plane/commit.ts`, `write.ts`, `read.ts`, with a `break` threshold ratcheted from the measured baseline. Run as `make mutate`, not inside `make test`, because the property suite is slow. Survivors become new oracle cases or invariants (AB-FRM-5).

## What Engram does differently
Property tests with random policies kill mutants probabilistically; seeds are fixed (`seedFor`), so scores are reproducible, which matters for rule 6 and thesis reproducibility.

## Risk to our claims
Equivalent mutants inflate survivors, so 100 percent is the wrong target. Runtime may be hours for all of core; restrict to load-bearing files. Vitest 5 compatibility is unverified, and embedded Postgres tests should be skipped (`ENGRAM_PG=skip`) under mutation.

## Open question
What is the mutation score of the invariants file alone versus the whole `make test`?

## Notes
mutmut covers `research/` Python; low priority since `make test-repro` already regenerates results byte for byte.
