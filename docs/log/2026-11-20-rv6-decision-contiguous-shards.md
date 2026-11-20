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
supersedes: none
---

**What.** A shard is a contiguous block of the config's items (items floor((i-1)N/n) to floor(iN/n) - 1), not every n-th item.

**Why.** The merged run must be byte-identical to the unsharded one, usage.jsonl included. The runners loop items outermost, so a block's rows, plane logs and ledger lines are contiguous in the unsharded run, and the merge is a concatenation. Usage records carry no item, so a strided slice could not be reordered without a new ledger field.

**Result.** Blocks hold equal numbers of items within one, so the calls balance; the Mem0 writes do not. On the pinned full set the largest block holds 1.133 times the mean turns at 4 shards and 1.222 at 8 (turns up to each checkpoint, summed per block).

**Consequence.** The wall-time estimate carries that imbalance; a strided or weighted split would need item ids in the ledger.
