---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/read.ts
  - packages/cli/src/tui/actor.ts
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/rerun.test.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** The last pass on E8.15c, the re-verification's five findings: the guard's taint through locals, its markers removed and regular expressions checked; a level-only change of actor hiding the answer, with the level named; the result screen's row after a switch tested; the later-read note found by the asking read's result, not by position.

**Why.** The re-verification of the N1 to N5 fix pass (scratchpad review-e8-15c.md, appended section) and the lead's decisions.

**Result.** `ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli packages/ui packages/view`: 50 files, 732 tests passed; `make lint` and `make lint-docs` pass; the reviewer's zz-rv-rerun, zz-rv-switch and zz-rv-switch2: 9 passed. Mutations, each on a committed tree, killed: the key ignoring the level, the stale result row, the note by position, the taint off, and real-source forms of a tainted local, a marker and a regular expression.

**Consequence.** E8.15d merges this push.
