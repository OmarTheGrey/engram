---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
  - packages/runner/src/conditions.ts
  - "pnpm exec vitest run packages/runner/test/retrieval.test.ts"
supersedes: docs/log/2026-11-02-x1r2-core-retrieval-pipeline.md
---

**What.** Every condition retrieves with core's pipeline (any query term, each item scored on its own, cut to the read limit). C2 and C3 run it over what the store lists; C4 walks its ranking to C5's list (`x1r3-c4-walk`); C5 reads through the plane `coreReadPlane` builds, after its filter, never searching the store.

**Why.** The superseded entry said the property held and that breaking either side failed 11 and 24 tests, but its test built its own plane, so the runner's wiring was untested (review round 3, V-3).

**Result.** The test now calls each condition's `memory_read` in a session built by `conditionSession`, as a run does. Dropping the limit in `coreReadPlane` fails 9 tests; removing the wrap fails 30; C4 without the walk fails 20.

**Consequence.** The product's default read is unchanged; ADR 0009's amendment is still proposed.
