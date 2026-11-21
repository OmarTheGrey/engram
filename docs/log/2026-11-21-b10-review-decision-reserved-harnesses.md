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
supersedes: docs/log/2026-11-21-b10-decision-harness-qualifies-item.md
---

**What.** The runner's own item prefixes (`gatemem`, `longmemeval`, `mem-inv-bench`, `faults`, `fault-set`) are reserved: a harness may not take one, at start or in a header. The item stays `<harness>/<item>`.

**Why.** Review B10-6: harness names shared a namespace with the runner's item prefixes, so a proxy key could be a runner key. A hit would still need the same model, seed and prompt hash, but reserving the names keeps the two sets of keys apart by construction.

**Result.** Each reserved name is a ProxyRefused at start and a 400 in a header. The same-key test is unchanged: it records under item `merit/q7`, and `merit` is not reserved, so it shows the key function is shared without relying on a runner prefix.

**Consequence.** A runner benchmark that adds an item prefix adds it to `RESERVED_HARNESSES`.
