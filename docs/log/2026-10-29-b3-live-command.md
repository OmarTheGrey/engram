---
date: 2026-10-29
author: claude-agent
type: decision
card: B3
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
  - packages/runner/src/live.ts
  - packages/runner/test/live.test.ts
supersedes: none
---

**What.** The live half of Gate B criterion 4 is `make run CONFIG=<config> MODEL=<provider/model> LIVE=1`, recording into `.engram/runs/<config>-live/<provider>/<model>/cassettes` by default; amended into ADR 0017.

**Why.** The plan left the directory and the guards to the card. A path under `.engram/` is ignored by git, so a live recording cannot be committed by accident, and a per-model folder keeps two models' cassettes apart.

**Result.** The run refuses under `ENGRAM_OFFLINE=1`, refuses a scripted model, and refuses a cassette directory inside, equal to or containing `fixtures/` or the config's cassettes. Tested with pi-ai's faux provider on the seeded API: 2 new calls with seed 1, then 0 on a rerun. Removing the offline guard or the overlap check fails 2 and 3 tests.

**Consequence.** Nothing runs until the pre-registration names the primary model and the lead supplies its key. No live call was made.
