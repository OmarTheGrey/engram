---
date: 2026-10-22
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/model/cached.ts
  - packages/runner/src/model/pi.ts
  - packages/runner/test/model/cached.test.ts
supersedes: none
---

**What.** Three minor review findings in the model call layer: a cache hit now records zero tokens and zero cost with the cassette's usage under `cached`; `ENGRAM_OFFLINE` is read on every call; earlier assistant turns reach pi-ai as typed assistant messages instead of a cast.

**Why.** Summing the cost ledger counted every rerun as a paid call, which would inflate the governance tax (H2); an offline flag set after the wrapper was built was ignored; the cast hid missing fields.

**Result.** Three new tests failed first and pass; the runner has 18 passing tests.

**Consequence.** Cost tables sum `cost_usd` directly; the cached usage stays available for audit.
