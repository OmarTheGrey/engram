---
date: 2026-11-21
author: claude-agent
type: change
card: E2.12
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - docs/deps.md
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: none
---

**What.** A differential property test decides each generated read and write with `evaluateRead` and `evaluateWrite` and with `@cedar-policy/cedar-wasm` 4.14.0 on the export, for strict, medium, permissive and generated policies.

**Why.** ADR 0041, decision 2: agreement on every generated request is the independent check of the evaluator the property tests lacked.

**Result.** 15 tests pass, 1,500 runs per preset property and 400 generated policies. Agreement is required on the decision, on the deciding Engram rule id being among Cedar's reasons, and on zero Cedar evaluation errors. Seven mutations of the export were each caught (validity end, floor, nanoseconds, grant expiry, opaque move id, relearning sources, first matrix row); an eighth was equivalent (`2026-11-21-e2-12-finding-expiry-bound-unobservable.md`). Coverage of `cedar.ts` is 100 percent of branches. The WASM `nodejs` build loads under vitest on Windows; 4.14.0 was published 2026-10-19.

**Consequence.** A disagreement now fails `make test` with its seed.
