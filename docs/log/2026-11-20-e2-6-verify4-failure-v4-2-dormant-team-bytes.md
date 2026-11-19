---
date: 2026-11-20
author: claude-agent
type: failure
card: E2.6
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Finding V4-2: a crashed promotion or derived write into a team or role scope whose bytes land after the sweep stays in that scope's store until something adopts that scope or a later offboarding sweeps it.

**Why.** Only the person scope is adopted, through `engram read`; no surface adopts a team or role scope.

**Result.** Not fixed here: ADR 0010 states the gap and a backlog row tracks covering it; the bytes are never projected or read through the plane meanwhile.

**Consequence.** A periodic sweep or `engram retain` over the scopes the log names would close it.
