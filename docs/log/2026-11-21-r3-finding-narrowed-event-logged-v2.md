---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - docs/research/positioning.md
  - docs/decisions/0003-event-log-and-sqlite.md
  - packages/core/src/schema.ts
  - https://github.com/milatechtransfer/heams
supersedes: docs/log/2026-11-21-r3-finding-narrowed-event-logged.md
---

**What.** "Event-logged" alone does not separate Engram from HEAMS, and the literature note's contrast on it was wrong.

**Why.** HEAMS's wrapper (`wrapper.py`, repository at dec2874; paper Sec. 4.5) logs each recall decision and each retention drop (and every priming decision) with an action, a reason, a policy id and a decision source. A retention STORE outside priming goes into the entry's metadata with no reason. Pure-LLM verdicts carry the model's text and no policy id; hybrid rule matches carry the rule's id (`recall_policy_hybrid.py`).

**Result.** The difference that holds: Engram's log is the source of truth and item state is a projection rebuilt from it (ADR 0003; `MemoryEvent` in `schema.ts`), every decision is an event with a rule id, and each is mirrored into the pi session (AGENTS.md rule 3). HEAMS's events are run records for scoring.

**Consequence.** Supersedes the first version (review finding R3-4).
