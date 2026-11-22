---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
supersedes: none
---

**What.** Four shape choices: a scope's answer names only read matrix rows, never grants; an item closed by status, ttl or validity has no readers and a `closed` reason; the owner also sees `dormant` grants (expired, another class, grants not honoured), each with why; both calls are judged at the read's access time (`accessTime`), and the CLI takes no `--at` but under `--test-clock`, as every non-read command.

**Why.** Grants live on items, so a scope's grants would be a per-item list, and naming them would show holders to non-owners. Exactness: readers must equal what `evaluateRead` admits now. Dormant grants answer the owner's next question at no cost to anyone else.

**Result.** All four are covered by the property tests and the panel's unit test.

**Consequence.** A future answer "who could read it at time t" needs a time argument on the server, which stamps its own clock today.
