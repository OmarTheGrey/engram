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
supersedes: none
---

**What.** Under C2 and C5, a reply holding text and memory calls is accepted: the memory calls are answered, and the agent is asked again. tau2's own protocol forbids text and a tool call in one message, so the same reply with a domain call would end as an `AgentError`, and under C1 there is no memory call to make.

**Why.** Review B11-12. Memory calls never reach tau2's orchestrator, so its message check never sees them; refusing them would mean writing a protocol check of our own into the shim.

**Result.** Recorded, not removed. It favours C2 and C5 over C1 equally, so it does not bias C5 minus C2, H5's test. It can make the gain over C1, which H5 reports but does not test, look slightly larger.

**Consequence.** Card X11 counts replies with text and memory calls in memory.jsonl, and reports the count beside the C1 contrast.
