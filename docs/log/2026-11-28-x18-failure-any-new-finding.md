---
date: 2026-11-28
author: claude-agent
type: failure
card: X18
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - docs/log/2026-11-28-x18-decision-lint-detection.md
supersedes: none
---

**What.** The first fixture run of the check counted a temporal-supersession fault as detected by the missing-provenance lint, at both places.

**Why.** Detection was any finding on the target that the clean state lacked. The closed item is outside the read filter, so the lints did not reach it in the clean state; restoring it made it reachable, and its natural finding (an assistant turn naming no model) appeared as new.

**Result.** A false detection, caught on the first run's output for question 66f24dbb of the vendored subset.

**Consequence.** Detection is now by the lint that checks the field each operator corrupts, and every other new finding is counted in its own column (decision entry docs/log/2026-11-28-x18-decision-lint-detection.md).
