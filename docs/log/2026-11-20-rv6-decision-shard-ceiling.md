---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/shard.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** A config's `spend_ceiling_usd` stays the whole run's ceiling per provider; each of n shards stops when a provider's spend in that shard reaches the ceiling divided by n.

**Why.** Shards may run on different machines and share no ledger, so a shard can only check its own spend. An even split matches the even split of items and keeps one number in the config, whatever n is.

**Result.** `shardConfig` divides the ceiling; the ceiling is outside the fingerprint (card RV1), so it changes no shard's identity. A shard that stops is not merged until it is resumed with a raised ceiling, so a merged summary is never a stopped subset.

**Consequence.** A run can stop with spend left in other shards; the lead raises the ceiling and resumes the shard that stopped. A shared ledger would need a store all shards reach, which this card does not add.
