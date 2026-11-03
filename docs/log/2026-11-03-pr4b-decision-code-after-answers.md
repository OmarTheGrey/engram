---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - packages/runner/src/research/h1-sessions.ts
  - research/analysis/h1.py
supersedes: none
---

**What.** The code that items 9 and 10 need (GateMem's sessions split by checkpoint kind; the refusal-leak checkpoints' ids and a sensitivity table) is left as a step before the tag, not written in this PR.

**Why.** Both depend on the lead's answers; part B's files are the protocol's documents, and `h1-sessions/1` would change twice if the lead chose otherwise.

**Result.** The readiness record lists both as step 2, with the files they touch, and v1 states the recommended analysis.

**Consequence.** Cost if wrong: one more PR before the tag, small (a converter field, a table option, their tests).
