---
date: 2026-10-29
author: claude-agent
type: change
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/adapter.ts
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/adopt.test.ts
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/plane/adopt-files.test.ts
  - packages/cli/src/setup.ts
  - packages/cli/test/read.test.ts
  - packages/cli/test/write.test.ts
  - packages/bench/src/gatemem/literal.ts
  - packages/bench/src/gatemem/py.ts
  - packages/bench/test/gatemem/edge.test.ts
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - "pnpm exec vitest run packages/core/test/unit/plane packages/adapters/test packages/cli packages/bench"
supersedes: none
---

**What.** Round 2 fixes for PR #6 (cards E8.2 and B1): the GateMem port's Python-literal replies and Unicode case matching, decimal-only `--confidence`, an id-source test, and adoption of unreadable or touched files.

**Why.** The verifier found single-quoted dict replies read as plain text, `(?i)istanbul` missing "İstanbul", `0x10` accepted as 16, a surviving mutant taking ids from Math.random, an unparseable file retired as "no longer in store", and a touched file re-adopted.

**Result.** `literal.ts` ports `ast.literal_eval`'s subset; `pyRegex` expands IGNORECASE as sre does; the Adapter contract gains optional `diagnostics` and `derivedFields`, so the retire reason names the store's diagnostic and touching a file adds no event (ADR 0013 and 0007 amendments). Every fix had a test that failed first; 20 mutants were killed, 1 is equivalent.

**Consequence.** A reply holding a set, bytes or a complex number, or a pattern with a back reference, stops a run with an error.
