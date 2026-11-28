---
date: 2026-11-28
author: claude-agent
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane/revalidate.ts
  - packages/core/src/events.ts
  - packages/core/test/unit/distill/drift.test.ts
supersedes: none
---

**What.** Every re-validation is one event: `retire` allow (retired) or deny (kept) under `<policy>/drift/<trigger>`, refusals as `retire` deny under `engram/drift/*`, and a restore as `promote` allow under `<policy>/drift/restored` putting back the same version, active.

**Why.** The event ops are a schema enum (rule 5), so no new op; a retirement decision that keeps the item is the retire rule's deny, as a budget shortfall is an evict deny. A restore carries the item at its retired version so the store record, untouched by retirement (ADR 0010), still matches it and nothing is rewritten.

**Result.** Only a user-sourced member of the scope may present a re-validation (ADR 0046 point 4), and only an item drift retired can be restored; a ttl, eviction or offboarding retirement cannot.

**Consequence.** Invariant 2's oracle judges only promotions the property test makes; a restore is not one of its operations yet (finding entry).
