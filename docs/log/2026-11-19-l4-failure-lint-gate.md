---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "make lint"
  - packages/runner/src/lint-fault-set.ts
supersedes: none
---

**What.** The first `make lint` failed four times over: biome refused an assignment inside an expression, tsc a finding tier typed without `procedural`, ruff three lines over 100 characters, and mypy two nested lookups returning Any.

**Why.** Written before the gate ran; the tier type copied two of the schema's three values, which would also have made the Python scorer fail on a procedural finding.

**Result.** Fixed: the tier is `LintFinding["tier"]`, the scorer accepts any tier, and a `dig` helper replaces the nested lookups.

**Consequence.** None beyond the fix.
