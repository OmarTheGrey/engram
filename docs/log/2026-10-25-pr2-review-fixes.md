---
date: 2026-10-25
author: claude-agent
type: change
card: E2.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/src/lint.ts
  - packages/core/test/unit/policy/load.test.ts
  - packages/core/test/unit/policy/load-edges.test.ts
  - packages/core/test/unit/policy/presets.test.ts
  - pnpm exec vitest run packages/core/test/unit/policy
supersedes: none
---

**What.** The review findings on the policy loader and presets (R3-1 to R3-9) are fixed, applying decisions D2 and D3.

**Why.** The loader accepted a policy with a missing level, unknown lint ids and threshold keys, and threw a raw ReferenceError on alias blow-up; medium claimed C5 runs lints.

**Result.** The loader rejects a policy missing a level at the `write` or `read.matrix` key, rejects unregistered or duplicate lint ids (`LINT_IDS`, `LIFECYCLE_TRIGGERS`, `LINT_THRESHOLD_KEYS` in lint.ts) at their line, and wraps toJS. Presets list only registered lints, say lists are for C6 and their numbers are proposed, and retain every admitted class. Each new test failed before its fix; six mutants were killed. Policy tests: 86 pass.

**Consequence.** Prereg v0.2 rewords C5 and C6; ADRs 0006 and 0008 record D2 and D3.
