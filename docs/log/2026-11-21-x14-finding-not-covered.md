---
date: 2026-11-21
author: claude-agent
type: finding
card: X14
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/configs/redteam.json
supersedes: none
---

**What.** Three guards and surfaces merged before this card are not exercised by it: protect_trusted, the verified actors of card E8.12, and the span export, who-can-read and framework kit of cards E8.13, E2.13 and E8.14.

**Why.** AMSB has no scenario that rewrites, retires or evicts another writer's item, and the surfaces sit above Plane.write and Plane.read, which is all the card drives.

**Result.** Turning protect_trusted on changes no row; the config's `not_run` names each.

**Consequence.** A rewrite or eviction attack family, and a surface-level suite, are later extensions.
