---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** The first protectBelow tests put Windows paths unquoted in bash commands; bash read the backslashes as escapes, so a command meant to run was blocked and one meant to be blocked failed in the shell for another reason.

**Why.** Earlier tests use unquoted paths only in commands that are blocked before any shell runs them.

**Result.** The new commands quote their paths.

**Consequence.** None beyond the fix.
