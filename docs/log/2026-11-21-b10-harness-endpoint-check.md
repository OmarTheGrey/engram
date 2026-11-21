---
date: 2026-11-21
author: claude-agent
type: change
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** `checkHarnessEndpoint(endpoint, proxy?)` is the helper a research config uses to refuse a harness model endpoint that is not the cassette proxy.

**Why.** ADR 0036, decision 4: a harness configured with any other endpoint is refused by its research config.

**Result.** Before the proxy starts it refuses any endpoint that cannot be the proxy (not plain http, not 127.0.0.1, credentials, a query, no port, a path other than /v1); given the running proxy, any endpoint that is not its base URL. The tests refuse the OpenAI and OpenRouter URLs, localhost, another port, another path, https and an unset endpoint. Its error states ADR 0036's limit: a configuration check, not a network control.

**Consequence.** B7 and B11 call it on the endpoint they hand LiteLLM.
