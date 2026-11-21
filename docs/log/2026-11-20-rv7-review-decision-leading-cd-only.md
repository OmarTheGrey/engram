---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
supersedes: none
---

**What.** Only a chain of literal `cd dir &&` at the very start of a command replaces the cwd. Every other `cd` adds folders and keeps the cwd.

**Why.** A word after the leading chain runs in that folder or not at all, so dropping the cwd there is exact. Elsewhere the flat word list has no positions, and a `cd` inside a subshell or nested script (`bash -c "cd /tmp && true"; cat memory/a.md`) leaves the outer folder unchanged. Dropping the cwd there would open a bypass. A folder holding `$`, a backtick or a glob could be anything, so it never replaces the cwd.

**Result.** `cd src && grep -r TODO .` passes, while a subshell, a nested script or a `;` still keeps the cwd.

**Consequence.** `cd src; grep -r TODO .` stays refused, a cost written in ADR 0014.
