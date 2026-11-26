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
  - "node rv-drive-r.ts m1.json (the reviewer's ConPTY driver; scratchpad log, store and home, --no-saved)"
  - packages/cli/test/tui/actor-switch.test.ts
supersedes: none
---

**What.** The gates on the tree that merges E8.15c into `cliupgrade-d`, and a short check under ConPTY.

**Why.** The coordinator's instruction after the merge.

**Result.** With `ENGRAM_OFFLINE=1`: every CLI, ui and view test, 53 files and 892 tests, passed (ui 68, view 3); `make test-e2e` 7 files and 52 tests passed; `make lint` and `make lint-docs` exit 0. Under ConPTY, at 100x30: an item page opened by id; a denied promotion handed off to person:sam, who approved it as reviewer; Serve started on 7383, then esc and `q`: exit 0, no uncaught error, the summary's last line "exit 0, stopped when the TUI quit", the port freed.

**Consequence.** One more merge when E8.15c's rebuildArgv fix lands.
