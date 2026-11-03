---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/scripts/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** MEM-INV-Bench's UNREAD sessions are decided only by a readings file (`h1-readings/1`): the two readers' names, and per session its item, condition, store, seed, the sha256 of the reply read, and each reader's verdict, HIT, REFUSED or MALFORMED.

**Why.** Upstream's `adjudication.py` keys recorded human readings by the exact reply; a live run's replies are new, so a reading is keyed by session and tied to its reply by hash. The review (P4A-1) asked for two members' readings applied before scoring.

**Result.** Agreeing readers replace UNREAD with their verdict; disagreeing ones leave the session out ("readers disagree"). A reading of another reply, of a scored session, or of no session in the run is refused. `make h1-table` writes the template `.engram/runs/h1-unread.json`; `READINGS=<file>` applies it. Without readings, UNREAD stays excluded.

**Consequence.** If wrong, readings could be keyed by reply alone, as upstream's are.
