---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.14
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/kit/test/conformance/suite.ts
  - packages/kit/test/conformance.test.ts
  - packages/ai-sdk/test/conformance.test.ts
  - "make test-one T=packages/kit/test/conformance.test.ts"
supersedes: docs/log/2026-11-21-e8-14-milestone-adapter-conformance.md
---

**What.** The kit's adapter conformance suite, corrected: its store claim is a static one over the dependency closure, and its runtime store-call case is gone.

**Why.** Review finding E8.14-3: the runtime case could not fail, since the suite's store is reachable only through the plane.

**Result.** Four cases: the dependency closure and the imports of every workspace package in it reach no store, server, CLI, pi or `getBuiltinModule`; a read shows the reader's memory and nothing of another scope; a denial is `EngramRejected` with the log's deny event; a subject built user-sourced writes as model whatever the input says. The meta test runs seven broken adapters, each failing its named case (keeps source and reads nothing added). Reference and ai-sdk pass 4 of 4.

**Consequence.** A module name computed at run time is out of the static check's reach.
