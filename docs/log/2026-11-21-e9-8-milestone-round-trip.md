---
date: 2026-11-21
author: claude-agent
type: milestone
card: E9.8
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/test/import-export.test.ts
  - test/e2e/cli.e2e.test.ts
  - "make test-one T=packages/cli/test/import-export.test.ts"
  - "pnpm exec vitest run --config test/e2e/vitest.config.ts test/e2e/cli.e2e.test.ts"
supersedes: none
---

**What.** The round-trip invariant holds: export seven rows, import into an empty workspace, a reviewer promotes the four semantic candidates, export again; content, class, scope and validity come back equal, and lineage equal under the id map.

**Why.** Card E9.8's acceptance, step 3.

**Result.** The round-trip test passes, with a promoted episode (retired) and its two confirmers named in a lineage of three. The `make test-e2e` smoke of export then import passes on SQLite and on embedded Postgres: 14 of 14 in test/e2e/cli.e2e.test.ts.

**Consequence.** The card's acceptance is met.
