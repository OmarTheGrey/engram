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
supersedes: docs/log/2026-11-21-b11-decision-proxy-per-role.md
---

**What.** The launcher starts three cassette proxies per task: the agent's, the user simulator's and the NL judge's. Each has its whole cell fixed: harness `tau2`, item `<domain>/<task>/<role>`, condition, key preset and store, and seed. The earlier entry counted 18 proxies per (condition, seed) on the slice; it was 6 (two roles, three tasks). It is now 9.

**Why.** The proxy's upstream sees only the request, so a scripted upstream gets its task from its proxy. The role in the item keeps the keys and the ledger's counts apart. The judge's proxy is reached through LiteLLM's environment, so it has no header to name the item, and its configuration fixes it (review B11-10, B11-5).

**Result.** Every endpoint passes `checkHarnessEndpoint` before tau2 is given it. On airline no judge proxy is called.

**Consequence.** If the item shape changes, the 62 fixture cassettes must be re-recorded.
