---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/run-tau2.ts
supersedes: none
---

**What.** The spike's first tau2 run failed with LiteLLM's `InternalServerError: Connection error`.

**Why.** The spike wrote the proxy's stdout and stderr to one file and read its first line as the base URL; that line was Node's SQLite ExperimentalWarning.

**Result.** With stderr apart, the URL was read and the run reached the proxy. The launcher passes each proxy's URL to tau2 in its job file and never parses process output for it; only `engram serve`'s start is read from stdout, by a pattern.

**Consequence.** None.
