---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/events.ts
  - packages/core/src/log/chain.ts
supersedes: none
---

**What.** The chain's append runs in appendEvent (events.ts), not in plane/commit.ts as the card's Files list names.

**Why.** Review finding E1.6-9: every event, from every plane operation and from replay and tests, is appended by appendEvent; commit.ts holds only the store-then-log protocol, and several writers append without it.

**Result.** One call, inside appendEvent's own transaction and so under the log's lock (card E2.6), chains every event, whoever appends it.

**Consequence.** A new append path that bypasses appendEvent would bypass the chain too; none exists.
