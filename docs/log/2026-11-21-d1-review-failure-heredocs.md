---
date: 2026-11-21
author: claude-agent
type: failure
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - docs/log/2026-11-21-d1-parser.md
supersedes: none
---

**What.** Twice in card D1, a Bash heredoc carrying Python failed: once with a backslash escape warning and an assertion miss, and once with an unexpected end of file on a quote.

**Why.** On this machine, heredocs whose bodies hold quotes, backticks or backslashes break in Git Bash, as the agent brief warns.

**Result.** The log entries and multi-line edits were written as Python files with the Write tool and run with `python -I`, and the edits applied. No file was left half written.

**Consequence.** None for the code. Later passes write such scripts as files first.
