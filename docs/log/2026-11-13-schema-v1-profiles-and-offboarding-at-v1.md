---
date: 2026-11-13
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/profiles/knowledge.yaml
  - packages/pi-package/profiles/twin.yaml
  - packages/core/test/replay/erasure.test.ts
  - packages/core/test/unit/plane/offboard-edges.test.ts
  - "make test-invariants"
  - "make api-check"
supersedes: none
---

**What.** Main was merged into the schema version 1 branch after cards E9.1, E9.2 and E9.7 landed, and their four version 0 sites were bumped to version 1: the knowledge and twin profiles, and the hand-built items and events in the E9.7 erasure and offboarding edge tests.

**Why.** Those cards merged first at version 0. After this PR a version 0 policy no longer loads (ADR 0002), so the profiles and fixtures move with the schema, as rule 5 asks of a schema PR.

**Result.** Core profile, plane, replay and schema tests: 18 files, 293 passed. `make test-invariants`: 5 passed. `make api-check`: no diff.

**Consequence.** Every PR merged after this one writes version 1; PRs #28, #32, #38, #36, #37 and #39 pick it up when they are brought up to date with main.
