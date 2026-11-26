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
supersedes: none
---

**What.** The stopping set is 401, 402, 403 and 404; a 403 whose body carries OpenRouter's moderation metadata (`reasons`, `flagged_input`) is an `answer refused` exclusion; five `answer refused` sessions in a row in one process stop the run with a `RefusalStreak`.

**Why.** The coordinator's decisions on review X20-2: with R6's `allow_fallbacks: false` a gone endpoint 404s every call, a moderation flag refuses one prompt, and a misread key or endpoint failure must not exclude a whole run.

**Result.** The fifth refused session is not recorded as a row; the four before it are kept, excluded. A session that answers or is capped resets the count. Each shard is its own process with its own count.

**Consequence.** On resume the count starts at zero; an operator resumes only after checking the provider. Five is low enough to stop within minutes.
