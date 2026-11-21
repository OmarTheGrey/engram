---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: evaluation
pillar: research
hypothesis: H5
evidence:
  - packages/bench/scripts/tau2_engram.py
  - packages/bench/src/tau2/result.ts
  - packages/bench/PINS.md
  - "node packages/bench/scripts/run-tau2.ts --config .engram/probe/cfg.json (retail task 36, C1)"
supersedes: none
---

**What.** For the lead: H5's metric is tau2's own reward, so rows now report `tau2_reward` beside the database hash alone (`db_reward`), and every task runs EvaluationType.ALL.

**Why.** Review B11-5. Retail's NL assertions need tau2's judge.

**Result.** The judge can be routed. LiteLLM reads its base URL from the environment, and the driver points it at a third proxy per task. A probe on retail task 36 recorded one judge call (`tau2/retail/36/judge`, model `gpt-4.1-2025-04-14`), then replayed it offline with 0 new calls. The judge is only called when a task has assertions: 40 of retail's 112 NL-basis tasks do (11 in its test split), and no airline task does.

**Consequence.** No amendment is needed to report tau2's reward on retail. The judge's model is fixed inside tau2, so a live retail run needs `gpt-4.1-2025-04-14` upstream.
