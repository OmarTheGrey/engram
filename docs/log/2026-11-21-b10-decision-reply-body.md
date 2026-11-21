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

**What.** A reply body does not depend on whether it was recorded or replayed: `created` is 0, the id is `chatcmpl-` and the key's first 32 hex digits, the usage is the recorded call's, and the JSON is canonical. Only the `x-engram-cache-hit` header differs.

**Why.** A harness writes its outputs from the bodies, so a replay must give it the same bytes as the live run for its results to regenerate (rule 9).

**Result.** The second-run test compares the three bodies of the recording run with a second recording run and with a replay: equal byte for byte.

**Consequence.** None.
