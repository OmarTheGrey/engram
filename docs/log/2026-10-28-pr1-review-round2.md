---
date: 2026-10-28
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/items.ts
  - packages/core/test/unit/items.test.ts
  - packages/core/test/replay/items-at.test.ts
  - docs/decisions/0002-schema-and-generated-contracts.md
  - docs/log/2026-10-28-pr1-review-fixes-corrected.md
  - docs/log/2026-10-28-s0-3-pi-import-rule-timeout-corrected.md
  - "pnpm exec vitest run packages/core"
supersedes: none
---

**What.** Fixed round 2 findings N1, N3 and N4 on PR #2, and ran the R2-6 mutation.

**Why.** Updating a superseded version in place made it the ref's holder; the seq backfill was untested on real histories; two log claims were wrong.

**Result.** `itemByStoreRef` now returns the active holder no active holder's lineage supersedes, seq breaking ties (ADR 0002 and 0005 amended). Two unit tests and the property failed before; the property now draws lineage and lineage overrules seq 68 times. Three mutants of the backfill (min for max, no allow filter, no op filter) each fail the new migration test. Four simulator mutants each fail the R2-6 test. Superseding entries correct 11 to 12 and the pi-import-rule timeout. Core runs 120 tests.

**Consequence.** PR #5's writes of new versions rely on this lookup.
