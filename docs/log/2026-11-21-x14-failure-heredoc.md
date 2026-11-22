---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/run.ts
supersedes: none
---

**What.** Two edits written as shell heredocs failed on quotes.

**Why.** Bash heredocs with quotes and backticks break on this machine, as the brief warned.

**Result.** The edits were redone with the file tools and Python scripts run from files.

**Consequence.** None.
