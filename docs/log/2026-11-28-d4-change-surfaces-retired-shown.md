---
date: 2026-11-28
author: claude-agent
type: change
card: D4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/view/src/provenance.ts
  - packages/view/test/package.test.ts
  - packages/cli/test/tui/frames-memory.test.ts
  - packages/cli/test/tui/__frames__/memory-item-retired-120x40-default.txt
supersedes: none
---

**What.** A drift-retired procedure shows as retired with its rule and reason on the TUI item page, and `@engram/view` (the item logic of the inspector and the TUI) projects an allowed retire or evict event onto the item it names.

**Why.** The lead asked that a retired procedure show as retired with its reason. Before, the item page took the state of the latest event carrying an item, so a procedure retired by a retire event (which carries none) read `active`, for ttl retirements too.

**Result.** Eight new frames (`memory-item-retired-*`, two sizes, four modes): the header reads `procedural person:dana retired`, and the retire event's detail shows its reason and `fixture.drift/drift/environment-changed`. No existing frame moved. `engram events` already prints every event's rule and reason.

**Consequence.** Read answers and `engram explain` name returned items only, so a retired item appears there only as a filtered count (finding entry).
