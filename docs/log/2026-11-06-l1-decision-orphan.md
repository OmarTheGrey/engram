---
date: 2026-11-06
author: claude-agent
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - fixtures/faults/orphan.flag.json
supersedes: none
---

**What.** orphan flags an item whose `provenance.ref` names an item id that is absent, out of the actor's reach or retired, or whose lineage names one that is absent, out of reach, evicted, or retired other than by its own supersession (`<policy>/promotion/superseded`).

**Why.** A promotion retires the version it supersedes, so a plain retired rule would flag every promoted item. A ref that is not an item id cannot be resolved without store I/O and is skipped. An unreachable item counts as absent, so a finding reveals nothing the actor cannot read (decision D5).

**Result.** The flag fixture refs an item retired by its ttl and has a lineage id never logged; the near-miss refs and descends from active items. The superseded case is a unit test.

**Consequence.** A cross-scope source the actor cannot read is flagged for that actor.
