---
date: 2026-11-21
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/scripts/run.ts
supersedes: none
---

**What.** The first edit of `run.ts` left the file unparseable, with "Unterminated string literal".

**Why.** The edit went through a bash heredoc, and its newline escapes reached the file as real newlines, a pitfall the brief names.

**Result.** The edit was redone from a Python script file. tsc and the run pass.

**Consequence.** None.
