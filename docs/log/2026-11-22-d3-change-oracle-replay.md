---
date: 2026-11-22
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: docs/log/2026-11-21-d3-finding-oracle-replay.md
---

**What.** The invariants' oracle judges replay admissions (`replayAdmits`), and invariant 2's promotion property presents a replay in one case in six (review finding D3-5). These are lead-owned files, and the coordinator arranges their second reviewer.

**Why.** The 2026-11-21 finding: invariant 2 did not cover a replay admission.

**Result.** `make test-invariants`: 17 passed. With the validation-source rule removed, invariant 2 fails on a counterexample the oracle refuses. With the plane's ref check removed, it fails its new guard (a refusal only the ref's tasks make, seen 0). Invariants 1 and 3 to 8 are untouched.

**Consequence.** The replay is still not in the log, so a dogfood log cannot be judged on it.
