---
date: 2026-10-29
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/gate-a-e0-e1-e2-plan.md
  - docs/decisions/0024-db-backends-synchronous-contract.md
  - docs/decisions/0025-retention-semantics.md
  - docs/decisions/0026-promotion-corroboration-and-review.md
supersedes: none
---

**What.** The lead asked the orchestrating session to take the six open decisions of `docs/tasks/gate-a-e0-e1-e2-plan.md` itself and to add what the literature review supports within the plan's scope.

**Why.** The decisions blocked PRs 2 to 6; the literature review (`docs/readings/litreview/README.md`, design section) already constrains most of them.

**Result.** Gate A is declared passed with two recorded exceptions; Postgres runs on a worker thread behind the synchronous contract (ADR 0024); retention and promotion get ADRs 0025 and 0026; the surfaces run the retention sweep as a scope member; MPBench's request is sent now and MEM-INV-Bench is the fallback. The plan's section 3 lists the enhancements the literature review adds (expiry at read, retired content kept out, independent corroboration, user-sourced reviewers, one tag shape across conditions).

**Consequence.** PRs 2, 4 and 5 can start. Every decision stays pending the lead's review.
