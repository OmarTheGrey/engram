---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** Review finding RV7-R10: the move refusal's check is now `move`, a new member of `WriteCheck`.

**Why.** It reported `version`, which names another check. `WriteCheck` is a TypeScript type in `evaluate.ts`; no schema, event or generated client carries it, so no schema change is needed.

**Result.** The type checks pass and `make api-check` shows no generated file changed.

**Consequence.** Nothing else. The review also named first-write forgery (RV7-R9): it is ADR 0034's stated limit, and the backlog row "A first write naming another owner" holds it, now cross-referenced from card RV7's rows.
