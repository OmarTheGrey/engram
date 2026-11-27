---
date: 2026-11-27
author: claude-agent
type: change
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/live.ts
  - packages/runner/test/rv6-endpoints.test.ts
  - "make test-one T=packages/runner/test/rv6-endpoints.test.ts"
supersedes: none
---

**What.** `liveConfig` now refuses an experiment config if its answer model or its judge (as `judgeModel` resolves it) is on OpenRouter and has no `openrouter_provider` pin for that role. The check runs before any folder is made or any call is sent. Pipeline configs, and models off OpenRouter, run as before.

**Why.** Review finding 10. Without the check, an experiment with no pin ran live with OpenRouter routing it freely. With it, pre-tag condition 5 holds by construction and does not depend on a test finding every config. The card's Files include `live.ts`.

**Result.** The test was written first. Two of its three cases failed before the change, and all 23 pass after it. The ten test files that use the live path pass, 134 of 134 (b6, count, lint-faults, live, rv1, rv1-review, rv6, rv6-checks, rv6-upstream, x1-mem-inv).

**Consequence.** A future experiment config cannot reach OpenRouter until it is pinned.
