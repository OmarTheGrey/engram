---
date: 2026-11-22
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/export.ts
  - packages/core/test/unit/portable.test.ts
  - packages/cli/test/import-export.test.ts
  - "make test-one T=packages/core/test/unit/portable.test.ts"
supersedes: docs/log/2026-11-21-e9-8-decision-bundle-selection.md
---

**What.** Every export is recorded by Plane.export as one `read` event by the exporter, decision allow under its read rule, naming no item and no scope, with a reason that counts the rows and events and names the policy; the selection rule of the superseded entry stands.

**Why.** The lead's decision on finding E9.8-3: export applies the read matrix and releases candidate, retired and expired content, so it is a policy decision (rule 3).

**Result.** One event per export; only its maker sees it (`eventVisibleTo`), even a member of the exported scope. It carries no `item_ids`, so an export never counts toward utility (ADR 0025) and the dogfood report does not judge exported items as reads. No schema change.

**Consequence.** The invariants' Plane surface list gains `export` (the decision of the same day).
