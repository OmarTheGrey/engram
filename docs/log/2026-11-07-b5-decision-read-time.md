---
date: 2026-11-07
author: claude-agent
type: decision
card: B5
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/longmemeval/plane.ts
  - packages/bench/scripts/longmemeval-date-facts.ts
  - "node packages/bench/scripts/longmemeval-date-facts.ts"
supersedes: none
---

**What.** Every LongMemEval read is made at the later of the question's date and the last history turn's time (`readTime`); the prompt still shows upstream's question date.

**Why.** Upstream asks each question after all its sessions (README.md), but some questions of the pinned release date a session after the question (finding entry `2026-11-07-b5-finding-dates.md`). Each turn is an item valid from its session's time, so a read at the question date would hide those turns under C5 and not under C2, which reads the store with no validity check: the comparison would measure upstream's dates, not the policy.

**Result.** `readTime` in `plane.ts`, used by `questionRead` and by the runner session's clock; `plane.test.ts` checks it on `c8090214_abs`, whose second session is dated after its question.

**Consequence.** Retention still applies at that read, so turns past a preset's ttl stay hidden under C5, which is a governance effect.
