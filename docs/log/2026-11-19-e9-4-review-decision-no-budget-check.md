---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** A grant change runs no retention budget check, unlike a write or a promotion.

**Why.** Budgets count active items of a class in a scope (ADR 0025); a grant change keeps the item's scope, class and status, so no count changes and no overage can arise from it. It does count as the item's last change for recency.

**Result.** Invariant 5's grant walk checks budgets after every step, grant changes included, and passes.

**Consequence.** If grants ever count toward a budget, this changes.
