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

**What.** A design observation, its numbers fixed by the faults' shapes: on B5's states the lints detect no deletion or supersession and repair nothing; the chain detects every edit that does not re-chain; B5's runner logs keep no chain.

**Why.** The lints check fields, not history: a deleted item raises an orphan only on an item naming it by id, which no B5 item does, and a reopened validity window looks like any open one. An editor who re-chains the log gets UNSIGNED, the controls' verdict, unless a checkpoint is held outside the database.

**Result.** `research/results/h3-fault-injection.json`: 0 of 990 log faults recovered after the lints; verification failed on every edited log and on no control.

**Consequence.** A state-recovery claim of this kind would rest on replay and a checkpointed chain, not on the lints; it says nothing of H3's utility recovery. Whether runner logs should keep the chain is the lead's question.
