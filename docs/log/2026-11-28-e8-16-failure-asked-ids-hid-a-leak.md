---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** The first mutation check, `eventVisibleTo` showing every team:x event to every actor, survived all four suites.

**Why.** The probes exempted every id the actor had asked about so far, and every canary id had been asked before the events route ran, so the leaked ids were exempt.

**Result.** Fixed by the three-pass order (decision `2026-11-28-e8-16-decision-echo-passes.md`); the mutant then failed 12 tests; a second mutant, expired grants admitted (`liveGrants`), failed 4 across HTTP, MCP and pi. Both reverted.

**Consequence.** Every echo exemption is now scoped to a call's own ids.
