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
  - docs/tasks/backlog.md
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
  - "make test-invariants"
supersedes: none
---

**What.** The review fix pass of card E2.7 (findings E2.7-1 to E2.7-6 and the C6 and C7 note) adds 26 tests and supersedes three log entries.

**Why.** The independent review confirmed both gaps and asked for them to be widened before they reach the lead.

**Result.** 22 preset cases (GH-38 in team and person scope under strict, medium and permissive) and four floor cases (promotion and retired content, each with a model-labelled control): "Tests 190 passed (190)". Two mutations caught: a sourceless write treated as `model` failed 7 floor cases; review applied to a retire failed the strict retire case. The GH-38 finding, the GH-39 finding and the lattice decision are superseded; the surface list moved to its own finding; the backlog gains the row "Sources for C6 and C7" and closes "Surfaces with no attested source".

**Consequence.** Card E2.11's scope widens to team scope, promotion and the retired-content rule.
