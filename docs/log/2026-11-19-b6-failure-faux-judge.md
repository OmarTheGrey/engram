---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/test/b6.test.ts
supersedes: none
---

**What.** The first live-run test made two calls, not three: the faux reader answered its own first call as the judge.

**Why.** One faux provider served the reader and the judge and told them apart by an absent system prompt, but the reader's context reached the faux step without one.

**Result.** The test now registers two faux providers, `faux-live` for the reader and `faux-judge` for the judge; it records three calls, seeded at 2, and replays them with 0 new.

**Consequence.** None for the code; faux tests should not infer the caller from the context.
