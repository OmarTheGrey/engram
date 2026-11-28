---
date: 2026-11-28
author: claude-agent
type: finding
card: X18
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-injection.json
  - packages/core/src/log/chain.ts
supersedes: none
---

**What.** On B5's states the deterministic lints detect no deletion and no supersession, and repair nothing; the hash chain detects every log edit, but B5's runner logs keep no chain.

**Why.** The lints check fields (a blank ref, a passed validity end), not history: a vanished item leaves no orphan when nothing names it by id, and a reopened validity window looks like any open one. Only replay against an intact log restores state, and only the chain tells an intact log from an edited one.

**Result.** `research/results/h3-fault-injection.json`: log faults recovered 0 of 990 after the lints, verification failed on 1,485 of 1,485 edited logs and on 0 of 500 controls.

**Consequence.** H3's recovery claim, in its fault-injection form, rests on replay and the chain rather than on the lints. Whether runner logs should keep the chain is the lead's question; nothing registered changes here.
