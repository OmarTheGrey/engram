---
date: 2026-11-21
author: claude-agent
type: change
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: none
---

**What.** `exportCedar(policy)` in `packages/core/src/policy/cedar.ts` returns a Cedar schema and policy set as text, and `cedarReadRequest` and `cedarWriteRequest` encode an actor, an item and a time as the Cedar request.

**Why.** ADR 0041: Cedar has a formal semantics and an analyser the typed policy lacks; the export makes an independent check of the evaluator possible.

**Result.** The read path exports the status rule, the item's own and the policy's ttl rules, one permit per read matrix row, the grant permit and the validity window. The write path exports membership, owner, version, move, default deny, forbidden classes, allowed sources, confidence floors, source isolation and retired content, plus a `write_without_review` action. Every Cedar policy carries `@id` and `@engram`, the Engram rule id. Core's runtime dependencies are unchanged; the policy set validates in Cedar's strict mode for the presets and 50 generated policies.

**Consequence.** An analyser card can start from this text.
