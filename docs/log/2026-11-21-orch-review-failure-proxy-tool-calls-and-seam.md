---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/B10.md
  - docs/tasks/B11.md
  - docs/tasks/B7.md
  - packages/bench/PINS.md
supersedes: none
---

**What.** Cards B10, B7 and B11 were not buildable as written (review finding AP-5).

**Why.** B10 returned 501 for tool-call requests while B11 drives tau2-bench, which `packages/bench/PINS.md` calls a tool-use harness; and B7 and B11 mapped a Python harness's memory calls to a TypeScript plane without saying how the call crosses.

**Result.** B10 now carries tool definitions and tool calls through unchanged and into the cache key; only streaming and embeddings return 501. B7 and B11 state the crossing: `engram serve` on loopback and a Python shim under `packages/bench/scripts/`, the agent's writes with source `model`. B11's spike also checks that tool calls survive the proxy.

**Consequence.** Whether tau2 sends tool definitions on every call is from the reviewer's memory; B11's spike settles it before more is built.
