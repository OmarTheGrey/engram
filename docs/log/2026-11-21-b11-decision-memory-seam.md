---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/scripts/tau2_engram.py
  - packages/bench/PINS.md
supersedes: none
---

**What.** The memory seam is tau2's agent: under C2 and C5, `EngramMemoryAgent`, a subclass of tau2's `LLMAgent` registered through `registry.register_agent_factory`, offers memory_write and memory_read beside the domain tools and answers a memory call inside its own turn, then asks the model again. A reply mixing memory and domain calls keeps both in the agent's history and hands the orchestrator only the domain calls. C1 is tau2's own `llm_agent`.

**Why.** The card asks where a memory layer is inserted. Routing memory calls through tau2's environment would put them in the trajectory its evaluator replays to compute the database hash, and in its action counts.

**Result.** The orchestrator, environment and evaluator never see a memory call; tau2's code is unchanged (`git status --porcelain` empty, checked before every run).

**Consequence.** If wrong, the steps tau2 counts exclude memory calls; memory.jsonl counts them apart.
