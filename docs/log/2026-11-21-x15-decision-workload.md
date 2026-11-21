---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: H2
evidence:
  - packages/core/bench/workload.ts
supersedes: none
---

**What.** The suite's store of N items is written once per store and size through the Plane under preset medium, as user-sourced semantic items in team scopes of at most 1,000 items, ten of them holding the read's word; each preset's plane is then timed over that one log and store.

**Why.** The card left the workload open. Strict requires review in team scopes, so it cannot write the store itself; 1,000 items per scope stays under every preset's team budget (strict 2,000). Timed writes go into the writer's own person scope, which every preset allows to a user, and stay under strict's person budget of 500. Ten fixed hits keep the read's result size constant.

**Result.** Every timed call is checked: a write must be allowed, a denied write denied, a read return ten items.

**Consequence.** Another reader or result size is another workload.
