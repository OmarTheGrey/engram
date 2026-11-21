---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/_template.md
supersedes: none
---

**What.** The first attempt to write this card's log entries failed: a Bash heredoc holding the generating script broke on its quotes and backticks.

**Why.** The brief warns that heredocs with quotes or backticks break on this machine.

**Result.** Bash reported an unexpected end of file and wrote nothing; the script was written with the Write tool and run with `python -I`.

**Consequence.** None.
