---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - docs/conventions/testing.md
supersedes: none
---

**What.** Card X16 edits `packages/core/test/property/invariants.test.ts`. testing.md says the file is the lead's, and that changing it needs a second reviewer and a decision entry. This is that entry. The change is additive: one fixed promotion case, one completeness check of offboarding, one candidate write in the walk, and a guard that counts only active confirmers.

**Why.** The orchestrator decided on 2026-11-28 that the file is the repository's test and that strengthening it is in scope. The card's independent review is the second reviewer. Existing checks are kept; each addition is one the audit showed missing.

**Result.** Every invariant test still passes (`make test-invariants`, 21 tests). Each new check kills the mutant it was written for.

**Consequence.** The candidate write changes what the two-handle walk exercises, though not its draws. A later change to the walk should keep a non-active item in the person scope.
