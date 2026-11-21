---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/tau2/launcher.ts
  - packages/bench/scripts/tau2_engram.py
supersedes: none
---

**What.** Two behaviours of LiteLLM 1.81.11 (tau2's lock) that a tau2 run through the proxy has to know.

**Why.** Found in the spike and the miss check.

**Result.** (1) tau2's `generate` sets `num_retries=3`, so a replay miss (404 `cassette_miss`) reaches the proxy four times; the proxy keeps all four in `errors` and the run stops with the first one named. (2) LiteLLM fetches its model price table from the network at import unless `LITELLM_LOCAL_MODEL_COST_MAP=True`; the launcher sets it. tau2 then prices the scripted models at 0 and logs the unknown model, which is harmless: the ledger, not tau2, is the cost record.

**Consequence.** X11's live run keeps tau2's retries, which the proxy answers as transient (503) or not (422) per card B10.
