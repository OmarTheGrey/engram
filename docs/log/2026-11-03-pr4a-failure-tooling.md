---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-03-pr4a-failure-restore-by-copy.md
supersedes: none
---

**What.** Two tooling failures on the way: the mutation runner's first run crashed printing a test's output, and the agent's shell refused several compound commands (a heredoc edit script, a `cd` before `git`, a loop over computed paths).

**Why.** The runner printed through Windows' console code page (cp1252), which cannot encode the test reporter's symbols; the shell's worktree isolation refuses any command whose git target it cannot verify.

**Result.** The crash came after each mutant was applied and in the `finally` that restores it, so every file was copied back and `git status` was clean; the runner now writes UTF-8 and the four mutants were rerun, all killed. The refused commands were split into plain ones, and file edits went through the edit tool, as the plan's agent brief advises.

**Consequence.** None for any result.
