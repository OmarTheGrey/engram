---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.15d
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/surfaces.ts
  - "node rv-drive-d.ts d1.json (the reviewers' ConPTY driver, scratchpad copy, cwd and --db and --root in the scratchpad)"
  - "node claude-run.mjs d3.raw w3 (the copied hook entry spawned as Claude Code spawns a command hook)"
supersedes: none
---

**What.** The real TUI driven under ConPTY over every new screen, at 80x24 and 120x40, with the log, store and home in the scratchpad; then the hook entry it copied, run as Claude Code runs one.

**Why.** The card's acceptance.

**Result.** Retain asked with the strong dialog and swept on y; Lint, Simulate and Doctor ran; Serve refused without a key file (exit 2, the CLI's message), created a key, started authenticated, stopped, kept running on esc, was stopped by ctrl+c with "exit 0, stopped when the TUI quit" printed; Doctor took `--keys` from Serve; MCP and the hook ran Try it; Export, Import, Keys and Log verify ran. The copied entry, `node.exe` plus the absolute `main.ts`, denied `mem0 add x` and a Read in the store root, each exit 0, and printed nothing for README.md.

**Consequence.** Try it's results sat below the fold: fixed by scrolling to them.
