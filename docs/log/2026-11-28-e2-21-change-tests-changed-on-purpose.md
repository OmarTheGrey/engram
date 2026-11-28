---
date: 2026-11-28
author: claude-agent
type: change
card: E2.21
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/write-grants.test.ts
  - packages/core/test/unit/policy/load-options.test.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - packages/cli/test/tui/frames-memory.test.ts
supersedes: none
---

**What.** The tests step 7 lists that the option changed, each on purpose.

**Why.** Every test file that loads `twin.yaml` or `knowledge.yaml` now runs with the option on.

**Result.** `write-grants.test.ts`: the class and expired tests' first-write halves now run under `uncapped()` (the twin profile without the option) and each gained an option-on counterpart; V-4's `roleItem` and RV-CORE-1's expired-grant test seed under `uncapped()` and judge under the twin profile, since a dormant or expired grant cannot be written under it. `load-options.test.ts`: the option's not-built rows removed; the profile test expects it on in both profiles; new loader, Cedar and simulate tests. `dogfood-report.test.ts`: `watch` gains `expiry_cap`, the format is 4. The frames: the hint line. Everything else listed passed unchanged.

**Consequence.** None of these is an acceptance test of an open card.
