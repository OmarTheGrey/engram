---
date: 2026-11-21
author: claude-agent
type: finding
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - docs/log/2026-11-21-b10-finding-for-harness-cards.md
  - packages/bench/src/merit/launch.ts
supersedes: none
---

**What.** How B7 took B10's five items.

**Why.** B10's finding lists what a harness card must connect.

**Result.** (1) @engram/bench may not import the runner (it depends on bench), so the launcher writes the ledger itself in the UsageRecord shape, with the recording guard from B10's fix pass (`repo`, `recordFixtures`). (2) No live upstream; scripted only. (3) Done: `openai/scripted/merit-d1`. (4) No tool messages with null content reach `callShape`; nothing reads these cassettes. (5) Calls are sequential.

**Consequence.** Card X7 joins the runner's live guards and budget.
