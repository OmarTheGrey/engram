---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** The first runs of the two-handle walk failed its store check twice for reasons in the check: adoption had re-recorded a plane write as import, and a promotion had retired its source only in the projection.

**Why.** Both are designed behaviour: adoption never writes the store (finding of `docs/log/2026-11-19-e9-4-finding-plane-writes-readopted-as-import.md`), and retirement never touches it (ADR 0010).

**Result.** The check compares store and projection as adoption does, without status, provenance kind and actor; no counterexample since, in 300 runs and in 8000 more.

**Consequence.** None.
