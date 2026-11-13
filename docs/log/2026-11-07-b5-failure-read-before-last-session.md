---
date: 2026-11-07
author: claude-agent
type: failure
card: B5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/longmemeval/plane.test.ts
  - "pnpm exec vitest run packages/bench/test/longmemeval"
supersedes: none
---

**What.** The first version read memory at the question's own date, and `plane.test.ts` failed on `c8090214_abs`: its read was earlier than the last write it should see.

**Why.** Upstream dates that question 2023/05/27 17:02 and its second session 18:16 the same day, so the read came before the session's turns were valid.

**Result.** Measuring the whole release found 43 such questions (finding entry `2026-11-07-b5-finding-dates.md`); the read now happens after the last turn, and the test passes.

**Consequence.** A benchmark's own dates are checked against the plane's validity before a harness relies on them.
