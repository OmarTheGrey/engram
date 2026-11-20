---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/events.ts
supersedes: none
---

**What.** Two shell commands hung during the fix pass and were stopped: a `cat >` with an unset variable waiting on input, and a Python heredoc that opened the interactive console on this machine.

**Why.** The agent brief warns that heredocs break here; both were attempts to edit files from Bash.

**Result.** Both were stopped by their task ids; no file was changed by either (checked with `git status`). Edits were then made with the Edit tool and with Python script files run as `python -I <file>`.

**Consequence.** None for the code.
