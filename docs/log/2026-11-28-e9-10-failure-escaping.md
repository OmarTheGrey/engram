---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
supersedes: none
---

**What.** The first scripted edit of doctor.ts stopped on an assertion: a `\n` inside a template literal did not survive the inline script's quoting, so the text to replace was not found.

**Why.** Quoting through a shell heredoc into Python into TypeScript.

**Result.** Nothing was written (the script asserts before writing); the edit was redone from a script file, as the brief advises.

**Consequence.** None beyond the lesson.
