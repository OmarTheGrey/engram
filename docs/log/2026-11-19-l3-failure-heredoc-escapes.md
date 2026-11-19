---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/runner/scripts/run.ts
supersedes: none
---

**What.** An edit to packages/runner/scripts/run.ts made through a Bash heredoc into Python turned the TypeScript escapes `\n` into real newlines, leaving unterminated strings.

**Why.** The brief warns that heredocs with quotes break on this machine; this one had no backticks and still changed escapes.

**Result.** tsc reported TS1002 at the two lines; they were fixed with the Edit tool. Two earlier heredoc edits had failed to parse at all.

**Consequence.** Edits go through files written with the Write tool and run with python -I, as the brief says.
