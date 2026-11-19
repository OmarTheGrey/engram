---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read-reason.ts
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** A read's requested validity time is recorded as the last clause of the read event's reason, `; validity windows judged at <time>`, parsed by `readValidAt`, and in each explanation's `validity.at`.

**Why.** The card forbids a schema change, and the event has no optional field for a second time; the reason is already the read's machine-written, round-tripped record (`formatReadReason` and `parseReadReason`).

**Result.** `parseReadReason` reads the counts of a reason with or without the clause; `ReadCounts`, its OpenAPI component, is unchanged. Status, ttl and grants are judged at ts, so the clause never widens what a reader gets.

**Consequence.** A dedicated `valid_at` field on read events would be a schema change of its own (rule 5) if the lead wants one. Cost if wrong: a reader of raw reasons has one more clause to skip.
