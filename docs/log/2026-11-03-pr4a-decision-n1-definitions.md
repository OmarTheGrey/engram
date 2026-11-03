---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/c4-evidence.ts
  - research/configs/h1-c4-walk.json
supersedes: none
---

**What.** The walk counts define C3's list as the shared pipeline's top 20 of every turn item, the query as each checkpoint's own question, and a "denied leak target" as an item the plane denies the asker whose text GateMem's scorer matches to one of the checkpoint's `leak_targets`.

**Why.** N-1 named the counts but not these three terms; the runner's C3 read and PR 3's length script already fix the first two, and the third follows PR 3's agreement finding, which counted leak-target turns the same way.

**Result.** The scored `not_include` patterns are not used, so the counts are about the secrets GateMem labels, not every scored phrase; the walk runs under medium only, since the plane's read decision is the same under all three presets.

**Consequence.** If wrong, a live model's own queries give other lists; the result says these are the lists for the checkpoint's question.
