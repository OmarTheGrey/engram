---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/nli.ts
supersedes: none
---

**What.** A pair's score is the larger contradiction probability of its two directions, premise the earlier item then the later.

**Why.** An NLI model is not symmetric, and a contradiction either way is one; this was settled before any score was seen.

**Result.** Each pair costs two local scores, both cached. On card L3's near-miss pair (a freeze that starts on Friday and ends the next Wednesday) the backward direction scored 0.9961 and the forward 0.5157, which set the upper threshold (see the threshold decision).

**Consequence.** The direction rule stays as decided; changing it after seeing the fixture would tune the tier on it. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
