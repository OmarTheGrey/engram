---
date: 2026-10-25
author: claude-agent
type: change
card: E2.1
chapter: implementation
pillar: plane
hypothesis: H2
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/policies/strict.yaml
  - packages/core/policies/medium.yaml
  - packages/core/policies/permissive.yaml
  - packages/core/test/unit/policy/load.test.ts
  - packages/core/test/unit/policy/presets.test.ts
  - "pnpm exec vitest run packages/core/test/unit/policy"
supersedes: none
---

**What.** Card E2.1 added `parsePolicy`, which turns YAML into a validated `Policy` or a `PolicyError` whose problems carry line and column, and three bundled presets (strict, medium, permissive) loaded by `loadPreset`.

**Why.** H2 sweeps policy strictness at three presets, and a policy author needs to know which line is wrong.

**Result.** Syntax errors, unknown fields, wrong enum values, missing fields and duplicate rules for one scope level are each reported at their YAML line; the presets load and are ordered by strictness under the invariant oracles (58 tests in the evidence files). An unterminated quote is reported at the end of the file, where the yaml parser detects it.

**Consequence.** E2.2 and E2.3 evaluate these presets; medium is the default enforced condition.
