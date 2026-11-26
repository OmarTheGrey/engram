---
date: 2026-11-23
author: claude-agent
type: milestone
card: E8.15d
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test packages/ui packages/view"
  - "ENGRAM_OFFLINE=1 make test-e2e"
  - packages/cli/test/tui/rerun.test.ts
supersedes: docs/log/2026-11-23-e8-15d-milestone-second-merge-gates.md
---

**What.** The gates on `cliupgrade-d` after merging E8.15c's last pass (12b57e65).

**Why.** The coordinator fast-forwards `cliupgrade` to this head.

**Result.** With `ENGRAM_OFFLINE=1`: every CLI, ui and view test, 54 files and 905 tests, passed (the first run had one timing failure in E8.15c's write preview, logged apart); `make test-e2e` 7 files and 52 tests passed; `make lint` and `make lint-docs` exit 0. The TUI alone: 15 files, 500 tests.

**Consequence.** `cliupgrade` holds E8.15a to E8.15d; E8.15e is next.
