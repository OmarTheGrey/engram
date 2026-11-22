---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: none
evidence:
  - research/configs/d2-induce-fixture.json
  - packages/runner/src/induce.ts
supersedes: none
---

**What.** The config names its sessions, and the induction does not sample them. The fixture takes the first success of each of the ten task families, plus one failure, `d1-02`, to show the skip. Cache key: item `distill/<data folder>`, condition `awm`, preset and store `none`.

**Why.** AWM samples one trajectory per intent template at random. A named list does the same with no randomness, and it leaves four sessions per family as held-out tasks for card D3. The preset changes no prompt.

**Result.** One call per seed. The fixture's prompt is 9,042 characters (`make run CONFIG=research/configs/d2-induce-fixture.json COUNT=1`).

**Consequence.** D3 replays on sessions outside the candidates' refs.
