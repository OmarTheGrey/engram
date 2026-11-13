---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/offboard-edges.test.ts
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** When the store failed to delete an item during offboarding (card E9.7), the plane still erased it from the projection and the log under a reason saying "deleted from the store", and adoption (`adoptStoreItems`, card E8.2) then re-imported its plaintext.

**Why.** The erasure only collected delete failures for the report and erased regardless. Adoption treats a store record the projection lacks as new.

**Result.** Fixed in the spirit of the handover failure path: such an item is not erased this run, gets one deny event under `engram/write/store-failure` naming the error, and is listed with its ref under `store_failures`; a rerun after the store recovers erases it. Each erase event now says whether its item was deleted, kept because an item outside the person scope shares its ref, or had no store record.

**Consequence.** A deletion report with `store_failures` means offboarding is not finished.
