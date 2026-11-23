---
date: 2026-11-22
author: claude-agent
type: change
card: L7
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/nli.ts
  - packages/core/test/unit/lint/nli.test.ts
  - "make test-one T=packages/core/test/unit/lint/nli.test.ts"
supersedes: none
---

**What.** Added the contradiction lint's local NLI tier to core: lint id `contradiction-nli`, threshold keys `contradiction-nli.upper` and `.lower`, `PlaneDeps.lintNli`, and the report's `nli` judgments.

**Why.** Card L7 asks for a middle tier that keeps only the uncertain band for the model, with the scorer injected so core imports nothing.

**Result.** A pair at or above the upper threshold is a finding, below the lower is dropped, between goes to the model with its usual request. Without the id or a scorer nothing changes; the loader refuses the id without both thresholds; no registered preset or profile lists it. 17 tests pass; removing the band filter fails one (mutation check). `make test-invariants`: 18 passed.

**Consequence.** No registered lint run changes. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
