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

**What.** The orchestrator's decisions for card X20, taken from the cards' independent review of 2026-11-26 and given to its implementer. A 401, 402 or 403 at any model call, GateMem's judge included, stops the run unrecorded. A 404 stops the run. A 403 that is a moderation flag is an `answer refused` exclusion; any other 403 stops. Five refusals in a row stop the run. The classifier reuses the status parser in `packages/runner/src/model/retry.ts`.

**Why.** The judge path: a non-transient judge error becomes `JudgeCallFailed`, which `cachedJudgeCall` writes into the cassette as a failed attempt (`judge.ts`, lines 128 to 143 and 221 to 238). When credit runs out mid H1, every later judge call would record a 402, sessions would lose their verdicts and a replay would reproduce it, the harm the 401, 402 and 403 rule of 2026-11-21 exists to prevent; pre-tag condition 3 says "from the provider", not only the answer call. The 404: with card R6's pins and `allow_fallbacks: false`, an endpoint that is gone (or a bad model id) fails every call with a 404 ("No endpoints found"), which as written would exclude every session and record a full run of exclusions. The moderation 403: OpenRouter documents a 403 for a moderation-flagged input, a refusal of one prompt, so stopping the run on it would let one item halt H1. Five in a row: a breaker for any run-wide cause no status names, so the worst case is five excluded sessions rather than a whole run. One parser: retry and refusal must read a status the same way, and `retry.ts` already reads it from pi-ai's `errorMessage`.

**Result.** Card X20's Goal, steps, Files, Decision and Out of scope carry these; the pre-registration's Statistics sentence, which X20 rewrites as the second of condition 3's two cards to merge, names the stopping statuses and the breaker.

**Consequence.** X20's Files gain `judge.ts`, `retry.ts`, `research/analysis/h1.py`, `research/tests/`, the pre-registration (one sentence and condition 3's status) and the backlog row. A refused utility session is counted by reason per condition in the H1 table, beside X21's `capped_utility`.
