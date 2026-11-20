---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/journal.ts
supersedes: none
---

**What.** A lock holder's start time is read from `ps -o etimes=` on POSIX and from CIM's `Win32_Process.CreationDate` through PowerShell on Windows, only when a lock is found held by a live pid; a start time that cannot be read counts as the holder's.

**Why.** A nonce alone cannot tell whether the live process with that pid is the holder; its start time can. The query costs about a second on Windows, and runs only when a lock is contended. Refusing when unsure keeps two writers out at the cost of a manual unlock.

**Result.** No new dependency; the takeover is a rename, which only one process can make.

**Consequence.** A heartbeat in the lock would avoid the process query, at the cost of false takeovers while the event loop is busy; not built.
