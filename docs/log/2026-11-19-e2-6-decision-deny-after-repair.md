---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** A stale decision puts the store back first, then appends its deny in a transaction that checks nothing changed the item since the state it wrote was read, repeating up to eight rounds.

**Why.** If the deny came before the store was put back, a newer writer could commit between them and the late repair would leave the store behind the log (ordering R12), and an adoption could list the stale bytes with no later event to warn it.

**Result.** R12 fails on main, where the deny precedes the repair, and passes here; removing the confirming check fails R12 on both backends.

**Consequence.** A conflict costs at least one extra store write and two transactions.
