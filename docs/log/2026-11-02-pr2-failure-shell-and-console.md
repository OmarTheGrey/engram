---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-10-29-b4-failure-worktree-shell-refusals.md
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Tooling failures on the way: a Bash heredoc holding a Python edit broke on its quotes; the worktree guard refused several compound shell commands (loops over files, `git` after a pipe, a variable as a `sed` operand); and the mutation-check script crashed decoding vitest's output in the Windows console code page.

**Why.** The heredoc and guard problems are the ones earlier PRs met; the console crash came from reading a child's UTF-8 output as cp1252.

**Result.** Edits went through Python scripts run with `python -I` and the Edit tool; commands were split into plain ones. The mutation script restores each mutated file from its saved bytes before it reports, and `git status` showed no mutation left behind; the two TypeScript mutants it was checking were killed (exit 1) before the crash.

**Consequence.** None for the code.
