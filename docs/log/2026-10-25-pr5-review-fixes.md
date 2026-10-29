---
date: 2026-10-25
author: claude-agent
type: change
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/adopt.test.ts
  - packages/cli/src/commands.ts
  - packages/cli/test/read.test.ts
  - packages/bench/src/gatemem/py.ts
  - packages/bench/test/gatemem/edge.test.ts
  - fixtures/bench/gatemem/upstream-edge-golden.json
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - docs/decisions/0003-event-log-and-sqlite.md
  - "pnpm exec vitest run packages/core/test/unit/plane packages/cli packages/bench"
supersedes: none
---

**What.** Fixes for the twelve review findings on PR #6 (cards E8.2 and B1), applying decisions D8 and D9, and the CLI moved onto PR #5's API.

**Why.** Adoption ran as whoever read and never retracted; deleted or newly denied files stayed readable; denied items were gated on every read. The CLI's log sat in the working directory and its ids bypassed the Io. The GateMem port printed 2.0 as 2 and matched `\w`, `\s` and `$` as JavaScript does.

**Result.** Adoption runs as the store's owner with source import, retires what the store no longer holds and skips unchanged denials; the log defaults to `<home>/.engram/engram.db`; `py.ts` reproduces Python's json, str and `re`. Every finding had a test that failed first; 22 mutants were killed and 1 survived until a `$` case was added to the golden.

**Consequence.** Harnesses calling `adoptStoreItems` get a report with `retired` and `retirements`.
