---
date: 2026-10-22
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/events.ts
  - packages/core/src/adapter.ts
  - packages/adapters/test/conformance/suite.ts
  - packages/runner/src/model/cached.ts
  - biome.json
  - docs/tasks/step-0.md
supersedes: none
---

**What.** Fixes for the eight important findings of the final step-0 review: allowed changing events must carry their item under the same id; `Db.transaction` refuses an async body; the Adapter contract moved to core and the Plane is asynchronous; the conformance suite tests an empty scope filter, skips missing optional methods visibly and moves full recall to an opt-in lexical suite; the cassette cache treats only a missing file as a miss, writes atomically and deduplicates calls in flight; pi subpath imports are rejected; ADRs 0002 to 0023 are marked pending the lead's review.

**Why.** Each would have cascaded into the E2 and A cards or misattributed decisions in the thesis.

**Result.** Every fix has a test that failed first; `make test` passes.

**Consequence.** Seventeen minor findings are deferred and listed in the step-0 report.
