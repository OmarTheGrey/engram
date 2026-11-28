---
date: 2026-11-28
author: claude-agent
type: decision
card: X18
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - docs/research/preregistration.md
supersedes: none
---

**What.** The clean state is B5's write phase plus one governed supersession per base: an item of B5's read, drawn by the seed, closed at the read time by a governed update (the shape of supersede.ts's closedVersion, through Plane.write).

**Why.** U6's temporal-supersession operator makes a superseded version current again, and B5's state holds none: every LongMemEval turn is its own version 1 item. Without a governed close the operator has nothing to act on.

**Result.** The clean read is B5's read less the closed item: one fewer item on the fixture's short histories, the next-ranked item filling the limit on the S split. The other two operators draw their targets from that clean read.

**Consequence.** The clean read is not B5's read byte for byte; the result's limits say so. If this is wrong, the supersession cells measure a synthetic close, not a natural one.
