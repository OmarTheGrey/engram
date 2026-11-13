---
date: 2026-11-13
author: claude-agent
type: finding
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/lint-leak.test.ts
  - packages/core/test/unit/lint/det.test.ts
supersedes: none
---

**What.** A lint event showed every member of the linted scope the content hash, status and retiring rule of an item outside it that only the linting actor could read.

**Why.** Card L1's amendment of ADR 0009 gated lint evidence on the linting actor's reach (`readableAt`), while the event visibility rule (`eventVisibleTo`, card E2.2's gate applied to the log) shows a lint event to any member of its target scope. Together a team member saw the hash of a colleague's private person note through a team lint.

**Result.** Reproduced with Dana linting team:core and Sam seeing the event. Fixed in `packages/core/src/lint/det.ts`: source-changed withholds the current hash of a source outside the scope, and orphan describes a retired item outside the scope as an absent one. A property test checks every visible lint event against what Plane.read returns.

**Consequence.** Card L3's model lints must follow the same rule.
