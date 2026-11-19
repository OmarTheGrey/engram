---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Review finding I1 of PR #44: `Plane.write` bypassed the owner rule of grant changes.

**Why.** A role co-holder refused by `changeGrants` could rewrite the owner's item through `Plane.write` at version plus one with the grant, and an outsider then read it; the item still named its owner, so the grant read as the owner's consent. Plan decision 4 makes a grant change a governed write, so this had to hold before the twin dogfood.

**Result.** `evaluateWrite` now judges a rewrite whose grants differ from the projected item's by the grant change's rules. Three tests (a co-holder's write that adds, removes or alters a grant is denied) and a property over rewrites fail without the owner check.

**Consequence.** Decisions `2026-11-19-e9-4-review-decision-import-may-change-grants.md` and `2026-11-19-e9-4-review-decision-grant-change-on-write.md`.
