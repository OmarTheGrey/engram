---
date: 2026-11-21
author: claude-agent
type: decision
card: B10
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/live.ts
  - packages/model/src/recording.ts
  - packages/runner/test/reserved-harnesses.test.ts
  - docs/tasks/B10.md
supersedes: docs/log/2026-11-21-b10-review-decision-recording-guard.md
---

**What.** Card B10's scope was widened at review beyond its Files list and its rule "nothing in another package": `packages/runner/src/live.ts` now calls the guard moved to `@engram/model`, and `packages/runner/test/reserved-harnesses.test.ts` is new. The card's Files line now names them and the other model files touched.

**Why.** Review B10-8 asked the proxy to reuse the runner's live-cassette guard, and ADR 0033 forbids `@engram/model` from importing the runner, so the guard moved and the runner calls it. Verification V-2 asked for a runner-side test, since only the runner knows its context functions.

**Result.** The runner's refusal messages are unchanged; the verification found the moved guard agreeing with the old one on 896 cases, and the runner's live tests pass.

**Consequence.** None beyond the two runner files.
