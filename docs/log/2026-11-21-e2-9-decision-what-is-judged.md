---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: none
---

**What.** The guard skips an item landing retired, and a rewrite of an active item that keeps its content; it judges every other write, a promotion's included.

**Why.** Rejecting a held candidate is retiring it, which a guard that judged retired items would refuse. A reviewer who promoted held content should not see it held again by the owner's next rewrite of, say, its confidence.

**Result.** Tested: a retired write is admitted; an unchanged rewrite of an active item is admitted, of a candidate is judged; under block a held candidate cannot be promoted (`as a write into team:platform`).

**Consequence.** If wrong, content admitted before a guard was turned on stays rewritable unchanged; it was stored already, so blocking the rewrite would not remove it.
