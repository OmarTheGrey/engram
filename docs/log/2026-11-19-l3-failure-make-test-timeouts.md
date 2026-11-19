---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/commits.test.ts
  - packages/runner/test/b3.test.ts
  - "pnpm exec vitest run packages/adapters/test/letta/commits.test.ts packages/runner/test/b3.test.ts"
supersedes: none
---

**What.** The first full `make test` on the L3 branch failed two tests by timeout, neither in a file L3 touched: the Letta commit test (30 s) and B3's offline cassette test (300 s, it ran 358 s).

**Why.** Two other agents were running their own suites on the same machine at the same time, as the brief warns.

**Result.** 2844 tests passed and 16 were skipped in that run; rerun alone, both files passed, 13 of 13 tests.

**Consequence.** Nothing changed in code; the timeouts are load, and the rest of the gate was run again on its own.
