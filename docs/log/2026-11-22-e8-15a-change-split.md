---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
supersedes: none
---

**What.** Every plane command in packages/cli/src/commands.ts is now a PlaneCommand in parts, prepare, request, call and print, run by `runPlane`; the exported `readCommand` and the rest call it.

**Why.** docs/design/tui.md 6.2: the TUI must make the same one client call the plain command makes and print the same text, so the parts must be reachable on their own.

**Result.** Every existing test file under packages/cli/test passes unchanged, run one by one with `make test-one` (29 files, the help snapshot changed by its first line and added lines only). `run` keeps its wrapping, E8.13's `drainExports` in its `finally` untouched.

**Consequence.** E8.15c and E8.15d call `open`, `request`, `call` and `print` from the TUI's runner.
