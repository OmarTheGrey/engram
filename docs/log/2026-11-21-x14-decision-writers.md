---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/routes.ts
  - packages/bench/src/mem-inv-bench/plane.ts
supersedes: none
---

**What.** Each source kind's writer is the MEM-INV-Bench channel that writes that kind (user, web for document, tool, agent for model), and external gets a connector of the web feed's shape; each scenario has its own `person:rt-<n>` and `team:rt-<n>` scopes.

**Why.** The card extends the poisoning arm of ADR 0029 rather than replacing it, so the harness uses its deployment; separate scopes keep one scenario's canary out of another's read.

**Result.** User and model content lands in person scope, document, tool and external in team scope, as in MEM-INV-Bench.

**Consequence.** The overlap table is computed from the same mapping. Cost if wrong: the scope a kind lands in.
