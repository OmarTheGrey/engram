---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.19
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - "make test-one T=packages/core/test/unit/dogfood-report.test.ts"
supersedes: none
---

**What.** On main since card D4 (#151), `dogfood-report.test.ts`'s rule-id test fails: `engram/drift/off`, `not-due`, `validation-source` and `membership` are named in core but missing from `ENGRAM_RULES`.

**Why.** Found while merging main into this branch. This card added its own six `engram/approval/` ids to the list; the drift ids are D4's.

**Result.** The test fails with exactly those four ids, on this branch and on main's `dogfood.ts`, which has no `engram/drift` entry.

**Consequence.** The orchestrator adds the four ids to the list, or D4 does it as a follow-up. Left out here to keep this card to its own ids.
