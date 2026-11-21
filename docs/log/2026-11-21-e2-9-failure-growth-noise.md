---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/admission.ts
supersedes: none
---

**What.** A growth ratio taken once, from 4,096 to 16,384 characters, called many linear gitleaks rules quadratic.

**Why.** At those sizes the timings are a few milliseconds, and cache and collection effects gave linear keyword rules ratios of 7 to 10; one rule read 85.8. At 262K the same rules grew about 4 times.

**Result.** Admission takes the fastest of three runs, ignores inputs under 1 ms at 4n, and refuses only when the ratio from 4n to 16n is over the limit too. Two full generator runs gave byte-identical tables.

**Consequence.** None beyond the decision.
