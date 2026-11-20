---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** The run lock could not tell a reused pid from its holder, took a stale lock over with unlink then create, and a merge did not lock the shard folders it read (review P60-8).

**Why.** The lock recorded only a pid and a host.

**Result.** The lock records its holder's start time and a nonce. A live process of this host whose start time differs by more than 2 s is not the holder; one whose start time cannot be read keeps the lock. A stale lock is renamed to a name of the attempt's own, checked by nonce, and given back if it changed. A merge holds every shard folder's lock. Tests: a live child process with another start time loses the lock and with its own keeps it; a shard resume during a merge is refused.

**Consequence.** A reused pid no longer blocks a run.
