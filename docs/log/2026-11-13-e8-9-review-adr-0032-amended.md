---
date: 2026-11-13
author: claude-agent
type: decision
card: E8.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0032-simulator-replays-recorded-calls.md
supersedes: none
---

**What.** ADR 0032 is amended: replay ids are the step's index and a per-step counter, and a later step cannot name a promotion's new item.

**Why.** One counter over the replay let one policy's extra events shift the ids of every later promoted item, so identical recall was reported as a change (`docs/log/2026-11-13-e8-9-review-step-ids.md`).

**Result.** The amendment is in `docs/decisions/0032-simulator-replays-recorded-calls.md`; the ADR stays proposed for the lead.

**Consequence.** Card PX2's converter cannot replay a promotion of an already promoted item; it is a known limit of the workload format.
