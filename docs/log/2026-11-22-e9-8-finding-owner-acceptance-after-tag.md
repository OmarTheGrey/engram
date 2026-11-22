---
date: 2026-11-22
author: claude-agent
type: finding
card: E9.8
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - packages/core/src/policy/promotion.ts
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: docs/log/2026-11-21-e9-8-finding-person-scope-import-needs-reviewer.md
---

**What.** A person alone still cannot make their own imported memories readable in their person scope, and the lead decided no ADR 0026 change before the `prereg-v1` tag.

**Why.** An owner's acceptance path would change promotion under the registered presets (finding E9.8-6).

**Result.** Until then a reviewer, a user-sourced member of the scope who is neither owner nor author, promotes, or the person restates a memory as a user write. The backlog row "An owner's acceptance of their own imported candidates" holds it for after the tag.

**Consequence.** Nothing changes before the tag.
