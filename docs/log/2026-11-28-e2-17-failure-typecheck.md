---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
supersedes: none
---

**What.** tsc refused the first explain command (`'a' is possibly 'undefined'` on an `in` narrowing of the two answers) and the fixture replay (`step.to` for a promote step, whose field is `to_scope`).

**Why.** Object literals of a conditional are unified with optional keys, so `in` does not narrow; the step field was misnamed.

**Result.** The answers carry a `kind` discriminant, the step uses `to_scope`; tsc is clean.

**Consequence.** None.
