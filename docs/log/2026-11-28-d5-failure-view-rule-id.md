---
date: 2026-11-28
author: claude-agent
type: failure
card: D5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/view/src/provenance.ts
  - packages/cli/src/tui/screens/item.ts
  - packages/cli/test/tui/no-policy.test.ts
supersedes: none
---

**What.** After merging main, `no-policy.test.ts` failed two tests: `packages/view/src/provenance.ts` named the rule id `engram/offboard/erase` and compared an event's policy id with it.

**Why.** The line came from card D4 (#151) on main, not from D5; D5's held-answer action already asks core (`reviewCouldLand`). The guard walks `packages/view`, which may hold no rule id.

**Result.** The view now takes core's `erases` predicate as an injected argument of `knownItems`, `provenanceGraph` and `itemVersions`; the TUI's item page passes `erases` from `@engram/core`. The guard test is unchanged and passes. Without the predicate an erased item shows as retired, its content already redacted by core; the inspector, which imports no core runtime, takes that default.

**Consequence.** If the inspector must show an erased item as absent, the answer it reads needs a field core computes (a later card).
