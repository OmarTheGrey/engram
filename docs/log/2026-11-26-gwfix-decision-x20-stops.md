---
date: 2026-11-26
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/X20.md
  - docs/log/2026-11-21-answers-decision-cap-in-billed-dollars.md
  - packages/runner/src/judge.ts
  - packages/runner/src/model/retry.ts
supersedes: none
---

**What.** Card X20: a 401, 402, 404, or 403 other than a moderation flag, at any model call, the judge's included, stops the run unrecorded; a moderation 403 is an `answer refused` exclusion; five refusals in a row stop the run; the classifier reuses `retry.ts`'s status parser.

**Why.** From the cards' review. The judge records any non-transient error as a failed attempt (`judge.ts`), so a credit failure mid H1 would strip every later verdict and replay that way. A pinned endpoint that is gone (R6, `allow_fallbacks: false`) or a bad model id answers every call with a 404, which would exclude a whole run. OpenRouter's moderation 403 refuses one prompt, so stopping on it lets one item halt H1. Five in a row bounds any run-wide cause no status names.

**Result.** X20 carries these.

**Consequence.** X20's Statistics sentence names the stopping statuses and the breaker.
