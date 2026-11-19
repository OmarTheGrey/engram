---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "bash: unexpected EOF while looking for matching quote"
supersedes: none
---

**What.** A Bash heredoc that held a Python edit of `packages/runner/src/count.ts` failed to parse.

**Why.** Its text held quotes and backticks, as the brief warns breaks heredocs on this machine.

**Result.** The edit was written as a Python file with the Write tool and run with `python -I`; it applied on the first run.

**Consequence.** Multi-line edits go through script files.
