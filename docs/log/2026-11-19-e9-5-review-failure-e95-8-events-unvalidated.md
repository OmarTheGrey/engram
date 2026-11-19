---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/scripts/dogfood-report.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-8 (important): the report did not validate the events it read.

**Why.** A string `item_ids` made the loop walk its characters (11 phantom violations), a bad `ts` printed `span_days: null`, and a body that was not JSON surfaced the parser's message, which can quote the row.

**Result.** Every stored row is parsed against the `MemoryEvent` schema (`parseEventRows`); a row that fails is named "event N does not parse" by seq alone, and no report is printed (exit 2). Tests damage a read event each way and check stdout is empty and stderr quotes nothing.

**Consequence.** A damaged log cannot produce counts.
