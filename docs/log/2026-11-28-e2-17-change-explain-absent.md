---
date: 2026-11-28
author: claude-agent
type: change
card: E2.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/explain-absent.ts
  - packages/core/test/property/explain-absent.test.ts
  - make test-one T=packages/core/test/property/explain-absent.test.ts
supersedes: none
---

**What.** `Plane.explainAbsent(actor, itemId, query)` returns a new, unpersisted `AbsenceExplanation`: the first stage (match, status, ttl, validity, rank cut) that keeps one item out of the read the query would make now, or that the read returns it.

**Why.** "Every recall can be explained" should hold for what a read did not recall.

**Result.** Computed by `readOutcomes` from the read's own predicates (reachable, `matching`, evaluateRead, retrieve) with no event and no store write; Plane.read is unchanged but for `matching` gaining an export. The property test, 15 tests, passes: on the two workloads under three presets and two retrieval modes, and on 150 generated reads, the stages counted before each read equal the counts its event records. Mutants killed: `not-active` mapped to validity (5 tests fail), the disclosure check replaced by "the id is projected" (1 fails).

**Consequence.** The route, the CLI, the TUI and MCP call it.
