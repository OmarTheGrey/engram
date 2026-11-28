---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/trace-replay.test.ts
supersedes: none
---

**What.** Three edit scripts passed through bash heredocs lost characters: a Python edit of `adopt.ts` failed to parse on a backtick, and a Makefile edit joined three lines by dropping its backslash-newlines.

**Why.** The brief warns that heredocs with quotes or backticks break.

**Result.** Both caught before any commit (the Makefile by `cat -A`); rewritten as script files run with `python -I`, and the Makefile fixed by hand.

**Consequence.** Every later edit went through a script file.
