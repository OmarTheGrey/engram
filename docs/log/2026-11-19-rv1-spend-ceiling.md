---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/config.ts
  - packages/runner/src/journal.ts
  - packages/runner/test/rv1.test.ts
supersedes: none
---

**What.** A runner config may set `spend_ceiling_usd`: before each session the run's usage ledger is summed by provider over its paid calls, and the run stops once any provider has reached it, keeping the sessions it completed (review finding RV-EXP-4).

**Why.** H2's stopping rule names a per-provider spend ceiling in the experiment config, and the runner had no field and no check.

**Result.** In `packages/runner/test/rv1.test.ts`, a faux model at 0.01 USD a call (two calls a session) and a ceiling of 0.03 stops before the third session: two rows kept, summary.json marked `stopped` with the provider, 0.04 USD spent and the ceiling. Raised to 1 USD and resumed, only the third session's two calls are paid. The command exits 3 when a run stops.

**Consequence.** The value is the lead's (backlog row "Spend ceiling").
