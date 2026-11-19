---
date: 2026-11-19
author: claude-agent
type: finding
card: RV1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/src/model/retry.ts
supersedes: none
---

**What.** A deterministic failure of the answer model, such as a 400 for a C1 prompt over the model's context limit, stops a live run for good: nothing records it, the outer retry does not retry it, and no exclusion reason exists for it.

**Why.** Found by the review of PR #55, outside its findings. The answer path records only replies, and a 400 is not one; every resume makes the same call and fails the same way.

**Result.** Not fixed here: a recorded answer failure with an exclusion reason (for example `answer refused by the provider`) is a protocol choice for the lead, like the turn limit. Backlog row "Deterministic answer failure".

**Consequence.** Before the tag, the lead decides how such a session is excluded, or the configs are checked against each model's context limit.
