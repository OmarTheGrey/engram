---
date: 2026-11-26
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/answer-refusal.test.ts
  - packages/runner/src/model/retry.ts
  - packages/runner/src/model/cassette.ts
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** A 401, 402, 403 or 404 stops the run, except a 403 whose body carries OpenRouter's moderation metadata (`reasons`, `flagged_input`), an `answer refused` exclusion; the run stops when five distinct items in a row each end in a refused answer call (`RefusalStreak`).

**Why.** The lead's answer of 2026-11-26 ("Amend: 404 + backstop", `docs/tasks/lead-decisions.md`): with R6's `allow_fallbacks: false` a gone endpoint 404s every call, and a misread key or endpoint failure must not exclude a whole run. Items, not sessions (review N1): the runner runs an item's 12 sessions back to back.

**Result.** One item refused in all 12 sessions runs on; the fifth refused item's session stops the run unrecorded; an item with no refused session resets the count, an item's own answered sessions do not. The count is per process, so per shard.

**Consequence.** A resume starts the count at zero; the operator resumes after checking the provider.
