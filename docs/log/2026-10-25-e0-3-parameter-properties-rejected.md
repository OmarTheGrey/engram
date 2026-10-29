---
date: 2026-10-25
author: claude-agent
type: failure
card: E0.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - "make lint"
supersedes: none
---

**What.** The first version of `NotImplementedYet` used TypeScript constructor parameter properties, and `make lint` failed in tsc with TS1294.

**Why.** The repository's tsconfig sets `erasableSyntaxOnly`, because Node runs the TypeScript sources by stripping types, and parameter properties emit code.

**Result.** The fields are now declared and assigned in the constructor body; tsc passes. Vitest had passed throughout, so only the lint gate caught it.

**Consequence.** None beyond the fix; core code avoids enums, namespaces and parameter properties.
