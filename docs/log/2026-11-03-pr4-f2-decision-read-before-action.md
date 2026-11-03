---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/src/mem-inv-probe.ts
  - research/analysis/h1.py
supersedes: none
---

**What.** `read_before_action` is true when the row's `read` is non-empty (D3). The share counts every session of the condition that records it, excluded ones too.

**Why.** `read` holds one entry per `memory_read` result, under every condition, C5 included. The action is the final reply, so any such result came before it. `tool_calls` would count a call that returned nothing to the model.

**Result.** Each MEM-INV-Bench rate gives `count`, `sessions` and `share`. It is null when no session records it, as with rows from before the field.

**Consequence.** Reading is a behaviour of the session, not of its score, so excluded sessions count.
