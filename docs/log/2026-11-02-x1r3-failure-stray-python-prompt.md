---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/judge.ts
supersedes: none
---

**What.** While editing the judge, a `python -I -` command with no script opened Python's interactive prompt, which looped on Windows console errors until the shell's two-minute limit moved it to the background.

**Why.** An edit was started as a command before its script was written; with standard input at its end, Python 3.14's new prompt kept failing to read the console instead of exiting.

**Result.** The process was stopped by the task id it was started under, nothing else was stopped, and no file changed; the edit was made with the editor instead.

**Consequence.** Edits go through a script file or the editor, never a bare interpreter.
