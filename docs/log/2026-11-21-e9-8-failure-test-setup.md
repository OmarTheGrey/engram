---
date: 2026-11-21
author: claude-agent
type: failure
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/test/import-export.test.ts
supersedes: none
---

**What.** Three test-setup mistakes failed the first runs: the files store needs `--owner`, a read without it failed silently to the test, and a refused import never creates the log, so reading its events threw.

**Why.** The tests were written before the commands ran once.

**Result.** Fixed in the tests: the store flags carry `--owner dana`, and a refused import is checked by the log file not existing. A shell heredoc holding backticks also broke the first append to commands.ts, as the brief warns; it was redone from a file.

**Consequence.** None for the code.
