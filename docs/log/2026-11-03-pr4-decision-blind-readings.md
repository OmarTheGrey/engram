---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
supersedes: docs/log/2026-11-03-pr4b-decision-unread-blind.md
---

**What.** The sheet still recommends that the members read MEM-INV-Bench's UNREAD replies without seeing each session's condition (decision sheet item 14), and the kit now does it.

**Why.** The superseded entry said the readings file named each session's condition, so someone who does not read had to hide it by hand; a hand step that can slip is weaker than a template that never holds the condition.

**Result.** The readers get `.engram/runs/h1-unread.json`: opaque ids, a seeded order, no condition, store, seed or item. Someone who does not read keeps `.engram/runs/h1-unread-key.json`; `make h1-table READINGS=<filled copy>` joins through it. Agreeing readers decide a session, disagreeing ones leave it excluded.

**Consequence.** If the lead declines, the readers are given the key too; no code changes, and v1 says so.
