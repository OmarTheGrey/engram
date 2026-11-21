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

**What.** The harness enters ADR 0017's key by qualifying the item: the proxy's CallContext item is `<harness>/<item>`, and a harness name may not contain a slash.

**Why.** ADR 0036 puts the harness in the key, and ADR 0017's key has no harness field; adding a field would need a new ADR. Qualifying the benchmark item keeps the seven fields and keeps two harnesses from sharing a key.

**Result.** The same-key test records a call through the runner's `cached()` path with item `merit/q7`, and the proxy replays it as harness `merit`, item `q7`, with the same key in `x-engram-cache-key` and in the ledger.

**Consequence.** If wrong, cassettes recorded under this rule stop replaying when it changes; none are recorded yet.
