---
date: 2026-10-22
author: claude-agent
type: decision
card: S0.9
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/plane.ts
  - "make test-invariants"
supersedes: docs/log/2026-10-22-s0-9-invariants-red.md
---

**What.** The lead-owned invariants file changed after the final step-0 review (an Opus reviewer, the second reviewer the testing convention requires): it runs in `make test`, invariants 1 and 2 are expected failures that must fail with their own counterexample, the Plane is asynchronous with the stub writing through the fake adapter, and invariants 2 and 4 check the store as well as the projection.

**Why.** Excluded from `make test` and run with continue-on-error, the file had no gate, and running it alone reported a false green.

**Result.** 51 core tests pass; `make test-invariants` still fails invariants 1 and 2 with a counterexample and a seed. The red properties now wait on E2.2 and E2.3, not E2.1.

**Consequence.** Issue #1 is retargeted; the lead confirms this change.
