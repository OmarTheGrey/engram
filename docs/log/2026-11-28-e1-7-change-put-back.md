---
date: 2026-11-28
author: claude-agent
type: change
card: E1.7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/test/unit/plane/erasure-gaps.test.ts
  - "make test-one T=packages/core/test/unit/plane/erasure-gaps.test.ts"
supersedes: none
---

**What.** The sweep's put-back (`offboard.ts` `run`) now decides each round as `commit.ts` `settle`'s `wanted` does: the projected item when it lives at the record's ref and its scope is not being erased, else nothing, and then the record is deleted.

**Why.** Finding E1.5-1: a third offboarding that erased the item between the put-back's read and its write left erased content in the store, since the next read ended the loop with `break`.

**Result.** `erasure-gaps.test.ts` drives that interleaving on two handles: the store ends with no record, on SQLite and on embedded Postgres (12 of 12 pass). With main's `offboard.ts` restored, only its put-back test fails, on both backends.

**Consequence.** No event or report field changes, so the offboard surfaces (CLI, TUI, server, MCP) are untouched.
