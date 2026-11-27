---
date: 2026-11-27
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-27-x20-finding-400-blocked-by-rv1.md
  - packages/runner/test/rv1.test.ts
  - packages/runner/test/rv1-review.test.ts
  - AGENTS.md
supersedes: docs/log/2026-11-27-x20-decision-400-and-content-filter.md
---

**What.** The orchestrator decided that a plain 400 at the answer call stays a stop. A prompt over the context limit, OpenRouter's moderation 403 and pi-ai's content_filter finish are still excluded as `answer refused`, as built. The any-400 patch is not applied.

**Why.** AGENTS.md ("How to work a task card", step 5) forbids changing the acceptance test, and the card's acceptance requires `rv1.test.ts` to pass unchanged. That test, and `rv1-review.test.ts:238`, expect a `400 Bad Request` to stop the run, so the acceptance wins over the Goal's "a 400".

**Result.** This replaces only the part of `2026-11-27-x20-decision-400-and-content-filter.md` that called for every 400 to be excluded. Its content_filter half stands. No code changes.

**Consequence.** The H1 runbook says what the operator does when a plain 400 recurs on one item.
