---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/runner/src/replay-validate.ts
  - packages/bench/src/tau2/result.ts
supersedes: none
---

**What.** The tau2 oracle is a function of card B11's task row (`tau2Reward`: its database hash check, refusing a row whose db_match and db_reward disagree); the fixture's tasks use a repository-state hash built the same way, and running tau2 with a candidate installed is left to card X11.

**Why.** Installing a candidate into tau2's agent needs a change to tau2's shim in packages/bench, another package, and tau2's environment is not on this machine.

**Result.** The oracle is unit-tested on rows in the shape B11 writes.

**Consequence.** X11 wires the launcher; if the shim cannot install a procedure, the oracle stays unused until it can.
