---
date: 2026-11-19
author: claude-agent
type: change
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/unit/oracle-grants.test.ts
supersedes: none
---

**What.** The oracle gains its own replay of a log (`replayEvent`, erasure included), `priorVersion`, `grantsChanged`, `grantChangePermitted` and `UNTRUSTED_KINDS`, with unit tests.

**Why.** The oracle had no function for ADR 0034's decision 6 (who may change what an item's grants admit); invariant 5's walk judged it inline. The report needs it as a function.

**Result.** Before: the rule existed only inline in `invariants.test.ts`. After: grants compared as multisets, the expiry as an instant; a class change of an item carrying grants counts; only the owner's `engram/grant/change` or the owner's own user- or import-sourced write may change them; a promotion's new version is compared with its source. 9 tests in `oracle-grants.test.ts`. The walk keeps its inline check, so its behaviour is unchanged.

**Consequence.** Invariant 5 could call `grantChangePermitted` instead of its inline check; that is a change to the lead-owned walk, left to the lead.
