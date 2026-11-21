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
supersedes: none
---

**What.** "Event-logged" alone does not separate Engram from HEAMS, and the literature note's contrast on it was wrong.

**Why.** HEAMS's wrapper logs each retention and recall decision as a memory event carrying an action, a reason, a policy id and a decision source (`wrapper.py`, `retain` and `recall`, repository at dec2874; paper Sec. 4.5). A decision its LLM made carries the model's text as its reason and no policy id (`judge_and_decide` in `retention_policy_hybrid.py`).

**Result.** The difference that holds: Engram's log is the source of truth and item state is a projection rebuilt from it (ADR 0003; `MemoryEvent` in `packages/core/src/schema.ts`), every event has a rule id, and each decision is mirrored into the pi session (AGENTS.md rule 3). HEAMS's events are run records for scoring.

**Consequence.** The claim keeps "event-logged" only next to "replayable"; `docs/research/positioning.md` states the difference.
