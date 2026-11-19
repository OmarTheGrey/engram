---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/scripts/dogfood-report.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-11 (minor): the script's errors repeated flag values and paths.

**Why.** Messages such as `--member <value> is not a scope` and `no event log at <path>` would put a member's names or folders into anything they paste.

**Result.** Every refusal names the flag, never its value, and no path; an unexpected error is named by its kind alone. A test runs five bad invocations carrying a planted word and finds it in none of their stderr; a mutant echoing the member value fails it.

**Consequence.** Nothing beyond the fix.
