---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/run.ts
  - packages/bench/src/amsb/schema.ts
supersedes: none
---

**What.** After the merge of main, `make lint` failed in tsc twice.

**Why.** A merged card widened `MemoryItem.content` beyond a string, and the amsb module exported two members named Control.

**Result.** Read content is turned into text as AMSB's harness does (`str(value)`), and the schema's control became `ControlRow`; `make lint` passes.

**Consequence.** None; planted content is always a string.
