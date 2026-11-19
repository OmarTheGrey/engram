---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
supersedes: none
---

**What.** A Python edit fed through a Bash heredoc failed on the procedure's Windows paths: the backslashes were read as escapes and the text did not match.

**Why.** The brief's known pitfall: heredocs mangle quotes and backslashes on this machine.

**Result.** The edit was rewritten as a script file with raw strings and applied; the file is unchanged otherwise.

**Consequence.** Edits with backslashes go through a script file.
