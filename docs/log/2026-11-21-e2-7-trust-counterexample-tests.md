---
date: 2026-11-21
author: claude-agent
type: change
card: E2.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
  - "make test-invariants"
supersedes: none
---

**What.** Card E2.7 adds `packages/core/test/counterexamples/trust.test.ts`, 164 characterisation tests of the suspected trust gaps GH-38 and GH-39, with nothing under `packages/core/src/` changed.

**Why.** ADR 0040 acts only on what tests confirm, and both gaps were found by reading the source, not by running it.

**Result.** 147 lattice cases (seven writer kinds by seven victim kinds by rewrite, retire and budget eviction), one count check, eight cases of the owner's rules and adoption, eight floor cases: "Tests 164 passed (164)"; `make test-invariants`: "Tests 8 passed (8)". Three mutations were each caught: flooring a sourceless write to `external` failed 5 floor cases; sparing user victims from eviction failed 8; denying a user item's rewrite by model, compaction or external failed 7. All restored.

**Consequence.** Card E2.11 starts from pinned behaviour: with its options off, these cases must stay green.
