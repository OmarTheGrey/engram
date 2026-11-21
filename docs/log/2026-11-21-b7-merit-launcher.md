---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/launch.ts
  - packages/bench/scripts/run-merit.ts
  - packages/bench/test/merit/launch.test.ts
supersedes: none
---

**What.** Card B7 adds the MERIT launcher: per run cell a cassette proxy with its cell fixed at start, `checkHarnessEndpoint` on the endpoint MERIT is given, and one MERIT process (`run_pilot.py --model openai/<model> --api-base <proxy>/v1`) over every cell.

**Why.** H2 is registered on MERIT, and its harness calls its model through LiteLLM, outside rules 6 and 7 unless the proxy of card B10 answers it.

**Result.** Every call goes to the proxy, its usage to `usage.jsonl` as the runner's UsageRecord with the cell named; a proxy error fails the run. The launch tests pass (2 tests): a replay of the slice makes 0 new calls, and an empty cache fails with `cassette_miss`. Mutation: ignoring proxy errors makes the miss test fail.

**Consequence.** Card X7 adds a live upstream (B10's finding 2); the launcher takes it as `upstream`.
