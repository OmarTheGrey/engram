---
date: 2026-11-21
author: claude-agent
type: change
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - packages/core/test/property/who-can-read.test.ts
  - make test-one T=packages/core/test/property/who-can-read.test.ts
supersedes: none
---

**What.** `Plane.whoCanReadItem(actor, id, at)` and `Plane.whoCanRead(actor, scope, at)` answer who can read an item or a scope's items as a symbolic set: "every member of S reading as L" per read matrix row, and "every actor grant i names" per live grant, each with its rule id.

**Why.** Card E2.13: the owner's first question before sharing, answered from the rules that decide a read (`readableScope`, `readRuleId`, `liveGrants`, `evaluateRead`). Shape: the idea of SpiceDB's LookupSubjects and OpenFGA's Expand (Apache-2.0).

**Result.** 5 tests pass, 400 runs per property. By brute force, the owner's answer expands to exactly the actors `evaluateRead` admits, each entry naming the rule `evaluateRead` names. Mutations caught: treating every grant as live fails agreement and leak; dropping the owner id check fails leak.

**Consequence.** The answer is the read filter's by construction and by test; a change to the read rules moves both together.
