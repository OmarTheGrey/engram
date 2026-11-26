---
date: 2026-11-26
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - README.md
  - packages/cli/README.md
  - research/results/h2-cost-table.json
  - node packages/cli/src/main.ts --help
supersedes: none
---

**What.** The root README, eleven package READMEs, `docs/README.md` and `research/README.md` describe Engram after the first absorb plan and show the terminal interface's screenshots.

**Why.** The lead asked for it; the READMEs dated from PR #90 (2026-11-21), before fifteen absorb cards merged.

**Result.** The root README gives the three products today, three TUI screenshots, a getting-started path to `engram tui`, and the absorb cards; the CLI README gives every command and the TUI with nine more. Images point at `docs/design/screens/`, on `cliupgrade` until the TUI merges. The one quoted number, 1,159 to 5,227 dollars, is `h2-cost-table.json`'s `decided` block. Quick start's `engram serve` now passes `--insecure-loopback`, which E8.12 requires.

**Consequence.** After main is merged in, every image path and the `packages/view` link are checked to resolve.
