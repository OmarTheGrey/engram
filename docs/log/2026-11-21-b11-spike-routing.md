---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: implementation
pillar: research
hypothesis: H5
evidence:
  - packages/bench/PINS.md
  - packages/bench/scripts/tau2_engram.py
  - "git -C .engram/upstream/tau2-bench log -1 --format=%H (fc0055dc4e0a316c3f83133267fbd6faaa770992)"
  - "tau2's run_single_task on airline task 19, llm_args api_base set to the proxy (spike, then make bench BENCH=tau2)"
supersedes: none
---

**What.** The spike: tau2-bench at `v1.0.1` (`fc0055d`) driven through card B10's proxy, unpatched.

**Why.** A call outside its LLM arguments would stop the card: a patched harness is not the pinned one.

**Result.** All three hold. (1) Agent and user simulator both reach the proxy through `llm_args` (`api_base`, a dummy `api_key`, `extra_headers` carrying `x-engram-item`); tau2's only model calls outside them are judges and reviewers that the ENV evaluation never runs. (2) The 14 airline tool definitions arrived equal to tau2's `openai_schema` as canonical JSON, and a reply's `tool_calls` cancelled Z7GOZK (reward 1.0, `db_match` true). (3) The body's `seed` is the cell seed when tau2's own `run_single_task(config, task, seed=...)` is called: its orchestrator sets it on both models. A replay miss is a 404, which LiteLLM's `num_retries=3` sends four times.

**Consequence.** The launcher is built on `run_single_task`, not `tau2 run`, whose batch derives a trial seed through `random`.
