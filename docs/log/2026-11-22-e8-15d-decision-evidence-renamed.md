---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/log/2026-11-22-e8-15d-change-parity.md
  - docs/log/2026-11-22-e8-15d-milestone-tests.md
  - packages/cli/test/tui/parity-surfaces.test.ts
supersedes: none
---

**What.** Five entries of this card, never merged, had their evidence path `packages/cli/test/tui/parity.test.ts` changed to `parity-surfaces.test.ts`; their bodies are untouched, and the two whose claims the move falsified are superseded.

**Why.** Entries are immutable, but `make lint-docs` fails an evidence path that does not exist, and after the merge `parity.test.ts` is E8.15c's file, so the old path would point at another part's tests. The file was moved, not rewritten: its cases are this part's.

**Result.** `make lint-docs` passes. The entries changed: change-parity, decision-json-view, failure-edits, failure-first-runs, milestone-tests.

**Consequence.** If the lead holds entries immutable even before merge, the five revert and the moved file keeps a stub under the old name.
