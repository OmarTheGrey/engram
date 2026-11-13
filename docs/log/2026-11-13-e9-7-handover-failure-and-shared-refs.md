---
date: 2026-11-13
author: claude-agent
type: decision
card: E9.7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
  - docs/decisions/0021-twin-scopes-and-grants.md
supersedes: none
---

**What.** A store failure during handover is denied with one event and stops offboarding before erasure; erasure keeps a store ref that an item outside the person scope also holds.

**Why.** Erasure cannot be undone, so it must not run after a partial handover, and offboarding again completes it because moved items are no longer the leaver's. A shared ref belongs to an item the leaver does not own alone; deleting it would erase shared memory.

**Result.** ADR 0010 and ADR 0021 amended (2026-11-13); the deletion report counts kept refs under `not_reached`.

**Consequence.** A kept ref may still hold an erased version's bytes in a store that keeps versions under one ref; the report says so.
