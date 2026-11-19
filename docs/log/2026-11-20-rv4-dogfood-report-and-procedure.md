---
date: 2026-11-20
author: claude-agent
type: change
card: RV4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - docs/dogfood.md
supersedes: none
---

**What.** The twin dogfood's report and procedure follow the adoption fix: `watch.provenance_raised` is 0 on the realistic synthetic log, the precondition "the adoption fix has merged" is gone, and the move and re-adoption limits are rewritten.

**Why.** The synthetic log counted two raises and five re-adoptions only because adoption raised trust; the procedure told members to wait on the fix and never to move the folder because a move failed closed.

**Result.** `pnpm exec vitest run --root packages/core test/unit/dogfood-report.test.ts`: 44 passed. The log's writes are `allowed: 9` (was 14); the real plane now refuses the owner's grant on the agent's item, so that test counts 0 violations; a planted raise is still counted, and a grant after it is a violation. `engram/adopt/rekeyed` joins the fixed rule list.

**Consequence.** A non-zero `provenance_raised` in a member's report is now a finding for the lead.
