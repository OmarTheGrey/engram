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

**What.** `checkHarnessEndpoint(endpoint, expected)` now requires `expected`: the running proxy's handle, or `{ port }` as the research config states it; an endpoint on any other port is refused, and so is a call with no valid port to check against.

**Why.** Review B10-1: without the handle, the check accepted any `http://127.0.0.1:<port>/v1`, including Ollama (11434), vLLM (8000), LM Studio (1234) and a LiteLLM proxy server (4000), which can forward to a paid API. That broke ADR 0036, decision 4.

**Result.** The tests refuse those four ports against a stated port of 7400 and accept 7400; `undefined`, `{}`, port 0, 70000 and 1.5 are refused. The handle satisfies `{ port }`, so existing calls with it are unchanged.

**Consequence.** A research config that runs a harness states the proxy's port, and the proxy is started on it (`port`).
