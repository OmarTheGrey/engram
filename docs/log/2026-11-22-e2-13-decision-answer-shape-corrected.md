---
date: 2026-11-22
author: claude-agent
type: decision
card: E2.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/who-can-read.test.ts
supersedes: docs/log/2026-11-21-e2-13-decision-answer-shape.md
---

**What.** The four shape choices stand: a scope's answer names only matrix rows; a closed item has no readers and a `closed` reason; the owner sees dormant grants; both calls are judged at the read's access time. One change, review finding E2.13-4: a non-owner is shown each grant as `grant:<to>`, without its place on the item; the owner keeps `grants[<i>]:<to>`.

**Why.** The earlier entry said all four were covered by tests. The review showed the access time was not: the mutation `const when = at;` survived, as did the validity branch of `closed`.

**Result.** A test whose log head is later than `at` asserts `answer.at` is the head and a grant expiring in between is dormant; the agreement test checks `closed` against status, ttl and validity in the filter's order. Both mutations now fail.

**Consequence.** `Plane.read`'s `grants_used` still names the index to a grantee; only this answer hides it.
