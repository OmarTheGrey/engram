---
date: 2026-11-28
author: claude-agent
type: change
card: D4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/revalidate.ts
  - packages/view/src/provenance.ts
  - packages/view/test/package.test.ts
  - packages/core/test/unit/distill/drift.test.ts
  - AGENTS.md
supersedes: none
---

**What.** The smaller review fixes of card D4: membership through the read matrix, the view's erasure, the test name, the card's file list and the command in AGENTS.md.

**Why.** Review findings 4, 7, 8, 10 and 11.

**Result.** A member whose level may not read the scope gets the outsider's opaque refusal (`readableScope`, tested). `@engram/view` drops an item an erasure (`engram/offboard/erase`) names, as core's projection does, instead of showing it retired (tested). The test once named for "an item retired otherwise" is renamed to what it covers, and the retired cases have their own test. `docs/tasks/D4.md`'s status lists every file outside the card's list with its reason. AGENTS.md and CLAUDE.md name `make run CONFIG=research/configs/d4-drift-fixture.json`. The acceptance file passes 28 of 28; the fixture replays with 0 new calls and the same bytes; `h1-drift-fixture.json` keeps sha256 `579fa43d...`.

**Consequence.** None beyond the fixes.
