---
date: 2026-11-21
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/runner/scripts/run.ts
supersedes: none
---

**What.** A scripted edit of `run.ts` put raw newlines inside two string literals, and `run.ts --record` stopped with ERR_INVALID_TYPESCRIPT_SYNTAX.

**Why.** A shell heredoc passed an escaped newline through Python as a real one.

**Result.** Fixed with a script file building the escape from chr(92); the recording then ran.

**Consequence.** Multi-line edits go through a script file, as the brief says.
