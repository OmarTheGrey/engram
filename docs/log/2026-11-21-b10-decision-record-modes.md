---
date: 2026-11-21
author: claude-agent
type: decision
card: B10
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** The proxy offers two of vcrpy's record modes (idea only, MIT): `none`, replay with every miss an error, the default; and `new_episodes`, replay what is recorded and record a miss from the upstream. `all` and `once` are refused.

**Why.** The card asks for the runner's modes in vcrpy's vocabulary. `none` is the runner's replay and `new_episodes` its live run, which replays what is recorded with zero calls. `all` would call the model again on a rerun (rule 7); `once` has no counterpart in the runner.

**Result.** Starting with `all` throws ProxyRefused naming rule 7; `new_episodes` under ENGRAM_OFFLINE=1 or without an upstream throws ProxyRefused. The offline check is read again on every call.

**Consequence.** A harness card that needs another mode adds it with its reason.
