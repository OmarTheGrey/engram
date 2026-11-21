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

**What.** The proxy's error statuses: a miss is 404 `cassette_miss`, a transient upstream failure 503, any other upstream failure 422 `upstream_error`, a malformed or contradicting request 400, streaming and embeddings 501; no failure is recorded in the cassettes.

**Why.** An OpenAI client retries 408, 409, 429 and 5xx. A miss must not be retried; a transient failure should be, as the runner's retry is; a permanent upstream failure retried would be paid for again.

**Result.** The transient test: a 503 leaves no cassette entry and the next call records. The 400 test: five refused requests, five entries in `errors`.

**Consequence.** If a harness card needs a permanent failure replayed, it records it as the runner's judge does (FAILED_CALL_MARK, card RV1).
