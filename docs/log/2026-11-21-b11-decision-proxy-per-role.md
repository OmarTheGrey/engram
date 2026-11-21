---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/launcher.ts
  - packages/bench/src/tau2/config.ts
supersedes: none
---

**What.** The launcher starts two cassette proxies per task, the agent's and the user simulator's, each with its whole cell fixed: harness `tau2`, item `<domain>/<task>/<role>`, condition, key preset and store, seed. The shim also sends the item as `x-engram-item`, which the proxy checks against its configuration.

**Why.** The proxy's upstream sees only the request, so a scripted upstream needs its task from its proxy; the role in the item keeps agent and user keys apart even when one model plays both (a live run may), and gives the ledger its per-role counts.

**Result.** 18 proxies per (condition, seed) on the slice, all on loopback; every endpoint passes `checkHarnessEndpoint` before tau2 is given it.

**Consequence.** If wrong, cassettes recorded under this item shape stop replaying when it changes; only the fixture's 62 exist.
