---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/bundle.ts
  - packages/core/src/policy/promotion.ts
  - docs/decisions/0026-promotion-corroboration-and-review.md
supersedes: none
---

**What.** An imported row is owned by the importer and written by the import actor, so neither the importer nor the import actor may approve its promotion.

**Why.** Owning the row by the import actor would let the importer review their own import: a laundering path into a scope that requires review (medium's org takes import and requires review).

**Result.** ADR 0026's rule holds unchanged: a reviewer is a user-sourced member of the scope who is neither owner nor author. The cost: a person alone cannot promote an import in their own person scope (the finding of the same day).

**Consequence.** If the lead prefers the owner to accept their own person-scope imports, that is an amendment of ADR 0026, not of this card.
