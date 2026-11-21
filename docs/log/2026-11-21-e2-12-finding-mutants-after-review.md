---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.12
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - packages/core/src/policy/cedar.ts
supersedes: none
---

**What.** After the fix pass, eleven mutants of the export or the evaluator were each run against the differential test, and every one was killed.

**Why.** The review found mutants the first pass let through. The fix pass had to show each named one now fails.

**Result.** Failing tests per mutant, each run by a scratch script that restores the file:
- Grant rules: no owner change rule 5; no untrusted-grants rule 5; no owner rewrite rule 6; no in-place exemption 7; sources narrowed to user 1, the duplicated-rules property alone.
- Instants: nanoseconds dropped 7; truncated to microseconds 5.
- Deduplication: no retention dedup 4; no write dedup 4; both, with unique ids 3.
- Precedence: the evaluator preferring a grant over a scope 5.

After the run the working tree matched HEAD, and the acceptance test passed 23 of 23.

**Consequence.** The import source is checked by one property only; a targeted case would strengthen it.
