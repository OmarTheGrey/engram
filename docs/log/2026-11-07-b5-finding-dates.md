---
date: 2026-11-07
author: claude-agent
type: finding
card: B5
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/longmemeval-date-facts.ts
  - "node packages/bench/scripts/longmemeval-date-facts.ts"
supersedes: none
---

**What.** Two facts about the dates of LongMemEval's pinned oracle release, as `longmemeval-date-facts.ts` reports them on the full file.

**Why.** Through the plane, a turn is an item valid from its session's date and retention excludes items past their ttl at read, so dates decide what C5 can return.

**Result.** 43 of 500 questions date a history session after the question itself (40 temporal-reasoning, 3 knowledge-update), by up to 23.3 hours. At the read, 40 of 500 questions hold a session older than the `medium` preset's person-scope episodic ttl of 90 days (28 knowledge-update, 12 temporal-reasoning), so C5 under `medium` hides those turns where C2 shows them.

**Consequence.** The read is placed after the last turn (decision entry `2026-11-07-b5-decision-read-time.md`). The second fact is a real cost of retention on long histories, and the live baseline under C5 reports it beside the accuracy.
