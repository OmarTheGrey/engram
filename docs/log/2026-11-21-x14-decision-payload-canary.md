---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/corpus.ts
supersedes: none
---

**What.** A payload row's canary is the whole row; deepset's rows labelled 0 are benign controls.

**Why.** The payload sets carry no canary of their own; the whole row coming back is AMSB's rule applied to it, and P1 names deepset's other rows as controls.

**Result.** 1,263 payload attacks and 399 deepset controls join AMSB's 21 and card X14's 43 controls.

**Consequence.** A shorter canary would only raise survival. Cost if wrong: the payload rows' survival.
