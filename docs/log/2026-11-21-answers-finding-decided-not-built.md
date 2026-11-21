---
date: 2026-11-21
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/tasks/lead-decisions.md
  - packages/core/src/plane/offboard.ts
  - packages/runner/src/lint-faults.ts
  - research/configs/h1-check-runs-cost.json
supersedes: none
---

**What.** Several answers of 2026-11-20 are carried into the documents but not yet true of the code or of documents outside the answers card's files.

**Why.** Some reasons in `docs/tasks/lead-decisions.md` say "built"; reading the code shows what is.

**Result.** Not built: items 14 and 15 (two exclusion counts, before the tag), 34 (expiry cap, first-write rule), 36 (grants a non-owner sees), 38 (offboarded scope refusing writes; hashes kept only for left or not-found records, `offboard.ts`; an appended file adopted again), 41 (any-term search), 44 and 46 (they move committed results), lint configs taking no ceiling (`lint-faults.ts`), endpoints. Stale outside this card: the smoke run priced on gpt-5.6-terra (`h1-check-runs-cost.json`) and named in the v1 plan's commands; `docs/dogfood.md`; the status lines of cards E9.5, X2 and X3; card B9's scope.

**Consequence.** Each is a row of the backlog's section "Decided, not yet built".
