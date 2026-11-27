---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/src/run.ts
  - packages/cli/src/tui/runner.ts
supersedes: none
---

**What.** `runPlane` prints the same answer a second time in the other mode, text or `--json`, when `Io.otherView` is set and the command has `--json`; the TUI's runner sets it, so `J` shows the `--json` bytes of the one call the action made.

**Why.** `J` must show the plain command's `--json` output, and a second call would append a second event (a second write, a second read). Reshaped outputs (read's, explain's) cannot be rebuilt from the raw answer.

**Result.** Additive: unset outside the TUI, so no plain output changes; export, whose print writes a file and which has no `--json`, is never printed twice. The parity test compares every `J` with a plain `--json` run byte for byte.

**Consequence.** If wrong, the TUI runs `--json` as a second plain call only for commands whose `writes` is none.
