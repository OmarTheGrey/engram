---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/decisions/0045-replay-validation-source.md
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** The plane derives the validation record from the held-out outcomes the caller presents, and only a user-sourced actor may present them (`engram/promote/validation-source`); ADR 0042, proposed.

**Why.** ADR 0026 refused a caller-stated record as a self-granted authority and left its source to D3; the replay runs outside core, so some evidence must be presented.

**Result.** A model-, tool- or unattested actor presenting a replay is denied (3 evaluator tests); the split, the threshold and the counting are core's, not the caller's.

**Consequence.** If wrong, a person can still present invented outcomes; a log-recorded replay would need a schema change.
