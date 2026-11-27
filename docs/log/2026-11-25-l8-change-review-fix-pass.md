---
date: 2026-11-25
author: claude-agent
type: change
card: L8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/src/lint/det.ts
  - packages/core/test/unit/plane/lint-read-filter.test.ts
  - docs/architecture.md
supersedes: docs/log/2026-11-25-l8-change-lint-read-filter.md
---

**What.** The review's fix pass:
- L8-1: `lintReach` refuses options that are not an object, and any reach but the two names, null included, in Plane.lint and planModelLints.
- L8-3 and L8-4: orphan settles which refused items count as gone (decision entry).
- L8-2 and L8-5: docs/architecture.md describes the reaches, and docs/roadmap.md has L8's row.

**Why.** The lead's review of L8 asked for these fixes.

**Result.** Three new tests failed first and now pass: 11 in the unit file. Mutations each fail them: dropping `dated`, the scope limit, the null refusal, or the object check.

**Consequence.** `LintContext.canAccess` is gone. `LintContext.dated` replaces it.
