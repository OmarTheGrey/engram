---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/test/merit/seam.test.ts
  - packages/bench/src/merit/summary.ts
  - packages/bench/src/merit/config.ts
  - packages/bench/test/merit/launch.test.ts
  - packages/bench/src/merit/scripted.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Review findings B7-4, B7-6, B7-7, B7-9 and B7-10, and the X7 backlog row.

**Why.** Each made a test unable to fail, a file misleading or a check missing.

**Result.** B7-4: the provenance test writes kind `user` and sees `model` in the event and the reply. B7-6: C1 and C2 cells write no empty `events.jsonl`. B7-7: two cells with one item are refused (test). B7-9: the reference comparison keys on the corruption setting (test), and the launch test checks the checkout with `ensureMeritCheckout`. B7-10: the agent's comment says it takes the last address in the notes' order. Backlog: C1's FullReplay prompts grow toward 60,000 characters, so X7 budgets them.

**Consequence.** None.
