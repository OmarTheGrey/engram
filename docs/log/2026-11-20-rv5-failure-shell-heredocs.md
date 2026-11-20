---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "bash -c with a heredoc holding quotes"
supersedes: none
---

**What.** Two edits sent through Bash heredocs failed to parse (an unmatched quote) and wrote nothing; one Python edit wrote CRLF line endings.

**Why.** Heredoc bodies holding both quote kinds and backticks break the shell's parse on this machine, as the brief warns; Python's `write_text` on Windows translates newlines.

**Result.** The edits were redone as script files written with the Write tool, writing bytes; `git diff` shows LF only.

**Consequence.** None for the code.
