---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - packages/core/src/plane/retrieve.ts
  - packages/core/src/plane/read.ts
  - docs/decisions/0009-retrieval-explanations.md
  - docs/architecture.md
supersedes: none
---

**What.** PR 3 changes files outside its plan's list: `packages/core/src/plane/retrieve.ts`, `read.ts` and `plane.ts` (the opt-in core pipeline), core's tests, ADR 0009 (a proposed amendment), `docs/architecture.md`'s read path, `packages/pi-extension/src/tag.ts` (round 1) and the plan's decision 4 (a dated note).

**Why.** One retrieval pipeline for every condition must live in core (AGENTS.md rule 1), and C5 can reach it only through the plane; the plan named the runner and the bench only.

**Result.** The core change is additive: a plane built without the option reads exactly as ADR 0009 was accepted, and the conformance suite, `read-leak.test.ts` and `make test-invariants` pass unchanged.

**Consequence.** The lead accepts or rejects ADR 0009's proposed amendment with ADR 0031.
