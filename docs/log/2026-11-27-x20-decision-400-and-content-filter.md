---
date: 2026-11-27
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/answer-refusal.test.ts
  - docs/tasks/X20.md
supersedes: none
---

**What.** The orchestrator decided, on the final review's findings 2 and 3, that any non-retryable 400 at the answer call (an overflow, with or without a body) and pi-ai's `Provider finish_reason: content_filter` are `answer refused` exclusions. This supersedes, without editing it, the narrowing in `2026-11-26-x20-decision-reading-the-status.md`. The content_filter half is built and tested.

**Why.** The card's Goal names "a 400" as an exclusion. Content_filter refuses one prompt, as a moderation 403 does. The lead's five-item backstop bounds a misread.

**Result.** 26 of 26 in answer-refusal.test.ts, three of them new for content_filter. The judge and note calls are unchanged: the card keeps the judge's recorded failure for every non-stopping status, and a note-call 400 is still recorded and falls back.

**Consequence.** The 400 half is blocked by RV1's tests (`2026-11-27-x20-finding-400-blocked-by-rv1.md`).
