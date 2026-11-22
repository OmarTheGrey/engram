---
date: 2026-11-22
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - "docs/decisions/0013-adapter-contract-and-conformance.md (amendment of 2026-11-22)"
  - "packages/adapters/src/lock.ts"
supersedes: none
---

**What.** The store lock's wait bounds one holder and starts again at each new acquisition; the lock is not made fair and the 10 s default is not raised.

**Why.** The refusal is for a stuck or slow writer, and its message names one holder; a queue of live writers is progress. A higher default only moves the threshold. A fair lock across processes needs a ticket queue in files. Each new acquisition is seen as a new lock text (another instance's token or a new start time); the token is per instance.

**Result.** ADR 0013 amendment, proposed. The files and Letta adapters both take it; no option or default changed.

**Consequence.** A waiter behind an unending stream of writers waits as long as the stream lasts. A holder past `lockWaitMs` is still refused, a dead one still broken at once. Fairness, if starvation shows, is its own card.
