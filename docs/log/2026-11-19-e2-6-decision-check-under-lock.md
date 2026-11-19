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
  - docs/decisions/0007-write-gate-and-source-isolation.md
supersedes: none
---

**What.** A store-then-log operation notes the log's head before reading the projection and, in the transaction that would append its allow, refuses if any write, update, promote, retire or evict event about the item, of any decision, came after that head, or an offboarding of its person scope began.

**Why.** The lock cannot span a store call: the Db contract is synchronous (ADR 0024) and SQLite's five-second busy timeout would fail every other process behind a slow store; a lease table would be a migration. Comparing events rather than the item also catches a concurrent writer's refusal.

**Result.** The check is two indexed queries per commit, on the log alone; no adapter gains a capability.

**Consequence.** A writer may be refused because another handle's refusal touched the item; it retries.
