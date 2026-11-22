---
date: 2026-11-21
author: claude-agent
type: change
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/scripts/admission.ts
  - packages/core/test/unit/policy/secrets.test.ts
  - packages/core/test/unit/policy/secrets-upstream.test.ts
  - "make test-one T=packages/core/test/unit/policy/secrets.test.ts"
supersedes: none
---

**What.** E2.9's review fix pass: six important and five minor findings fixed, rebased onto main.

**Why.** The independent review found quadratic rules, numbers never scanned, two skips of the guard that let a secret through, a result without its limits, untested hand rules, and smaller defects.

**Result.** Rules admitted by growth and cost; scan limit 64K; email anchored; overlaps by sort and sweep, the scan stopping at the deciding match; numbers scanned; skips need scope, class and content unchanged; promotion names the guard; fewer false positives; one case per hand kind and the sources' vectors (361 tests in the two files, 100 percent branches on `secrets.ts` and `backtracking.ts`); `make gitleaks-rules`; result renamed. Two backlog rows: `provenance.ref` is not scanned; an adoption deny event holds an unkeyed sha256.

**Consequence.** Mutations caught: the unanchored email fails admission; dropping the scope check fails the E2.9-3 test.
