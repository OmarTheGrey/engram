---
date: 2026-11-28
author: claude-agent
type: failure
card: D5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - "pnpm exec vitest run --project @engram/core"
supersedes: none
---

**What.** The first full run of the core project on this branch failed one of 3,678 tests: the dogfood report's fixed list of rule ids (E95-12) lacked `engram/promote/safety-scan`.

**Why.** The test reads every `engram/` rule id core names; the card's earlier gates ran only the modules it changed, so the list was never checked.

**Result.** The id is added to `ENGRAM_RULES` in `packages/core/src/dogfood.ts`; the dogfood and procedural tests pass, 157.

**Consequence.** A card adding a rule id adds it to that list; the full core project is run once before reporting.
