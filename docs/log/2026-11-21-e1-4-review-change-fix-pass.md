---
date: 2026-11-21
author: claude-agent
type: change
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - packages/core/test/unit/plane/crash-windows.test.ts
  - "make test-invariants"
  - "ENGRAM_STATEFUL_RUNS=2000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** The review fix pass of card E1.4 (findings E1.4-1 to E1.4-6).

**Why.** The independent review found the documented replay broken, a model that rarely reached what it guards, an uncovered settle window, an F3 relaxation too broad, and F1 understated and out of date.

**Result.** Replay takes seed, path and replay path, and a test replays a shrunk counterexample to the same list. The model names live items, adds Lee (co-holder) and his person scope, and weights reopens down; a default run now meets 45 allowed promotions, 58 evictions, 51 granted reads and 78 grant changes, floors of 20 asserted. The retired-readable core mutation is caught at the default size in three commands. Crash cases W7, W7b, G3, G3b, G4 added (61 of 61). The F3 filter is narrowed to the owner's own raise. New findings E14-F5 and E14-F6.

**Consequence.** Six findings for the lead.
