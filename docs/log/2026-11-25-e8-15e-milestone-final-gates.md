---
date: 2026-11-25
author: claude-agent
type: milestone
card: E8.15e
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test packages/ui packages/view"
  - "ENGRAM_OFFLINE=1 make test-e2e"
  - test/e2e/tui.e2e.test.ts
  - docs/design/tui-manual-check.md
supersedes: docs/log/2026-11-23-e8-15e-milestone-paused.md
---

**What.** E8.15e finished on cliupgrade: the make test-e2e line in AGENTS.md and CLAUDE.md (still byte-identical) names the TUI smokes, the manual check says which guards the Serve smoke does not catch, and every gate but the full make test, left to the lead, was run with ENGRAM_OFFLINE=1.

**Why.** The remaining items of the paused entry.

**Result.** CLI, ui and view tests: 56 files, 962 tests passed. make lint and make lint-docs passed. make test-e2e: 8 files, 57 tests passed, the TUI smokes and embedded Postgres among them, no skip. Whole-card acceptance: parity.test.ts 19 and parity-surfaces.test.ts 22 passed, line.test.ts 22 passed, and no file under packages/cli/test outside test/tui changed since 4816409a. No timeout met.

**Consequence.** E8.15e awaits an independent review; ADR 0044 stays proposed.
