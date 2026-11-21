---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/smoke-h1-gatemem.json
  - research/configs/smoke-h1-mem-inv.json
  - research/results/h1-check-runs-cost.json
  - packages/runner/test/rv6-checks.test.ts
supersedes: docs/log/2026-11-21-answers-decision-limits-on-runner-configs-only.md
---

**What.** The smoke run's two configs gain `turn_limit` 8, so the check runs H1's limit (review finding ANS-10); the lint configs still take none.

**Why.** The smoke run checks H1's live path, and the cap is part of it.

**Result.** `h1-check-runs-cost.json` reads the smoke configs through COUNT and the C1 prompts, neither of which holds the limit: rerunning `research/scripts/h1_check_runs_cost.py` gives sha256 `fd5a2507...`, the MANIFEST's. The RV6 test now holds the smoke configs' limit equal to H1's.

**Consequence.** Nothing else moves.
