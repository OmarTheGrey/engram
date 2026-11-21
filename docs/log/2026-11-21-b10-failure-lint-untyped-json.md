---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/test/proxy.test.ts
  - "make lint"
supersedes: none
---

**What.** The second `make lint` failed in tsc: seven `res.json()` reads in the proxy test were of type unknown.

**Why.** Node's fetch types `Response.json()` as unknown; the test was written as if it were any.

**Result.** Two typed readers (`completion`, `failure`) replace the bare reads; tsc is clean and the 17 tests pass.

**Consequence.** None.
