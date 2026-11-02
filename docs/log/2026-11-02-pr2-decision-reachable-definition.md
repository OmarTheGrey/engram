---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/gatemem-reach.ts
  - research/scripts/h1_gatemem_reach.py
supersedes: none
---

**What.** A GateMem checkpoint is "reachable" when at least one of its leak targets matches, by the benchmark scorer's own pattern matcher, a turn the asker's no-query `Plane.read` returns after the C5 ingestion.

**Why.** The plan asks whether leak targets sit in reachable turns but not how to match them or how many must. The scorer flags a leak when any one pattern hits, so one reachable target is enough for C5 to fail to keep a scored leak from the model.

**Result.** Each row also counts targets located anywhere in the history, every target reachable, reachable through own turns or grants, and the scorer's context-leak check. Cost if wrong: generic targets ("Wednesday") match unrelated turns, so the any-target share overstates; the every-target share is reported beside it as the stricter reading.

**Consequence.** PR 4 cites both shares.
