---
date: 2026-10-28
author: claude-agent
type: change
card: E2.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load-edges.test.ts
  - packages/core/test/unit/policy/presets.test.ts
  - packages/core/policies/strict.yaml
  - "pnpm exec vitest run packages/core/test/unit/policy"
supersedes: none
---

**What.** Fixed round 2 finding N2 on PR #3, tested strict's role read, and ran the R3-9 mutation.

**Why.** "Too many aliases" was reported at the document's first alias, an innocent one in the verifier's probe; strict's comment claimed an untested read rule.

**Result.** The loader now notes the alias yaml was resolving, with a context, when it threw. The verifier's probe moves from 18:32 to 39:50, inside the bomb. The two position tests failed first at 38:10 and 18:32. Four mutants of the trace each fail a test. A new test shows a role context, even its own person's, cannot read person scope under strict; adding person to strict's role row fails it. Nulling or removing permissive's org episodic retention fails the retention test. Policy tests: 99.

**Consequence.** The trace relies on yaml 2.9.1 never nesting resolutions; a yaml upgrade reruns these tests.
