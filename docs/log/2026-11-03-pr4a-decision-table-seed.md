---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-table.json
  - research/analysis/h1.py
supersedes: none
---

**What.** The H1 table's bootstrap seed is 20261103, fixed in `research/configs/h1-table.json` before any H1 session exists.

**Why.** `build_h1_table` draws each contrast's resamples from the config's seed and a hash of the contrast (AGENTS.md rule 6); the seed must be fixed in the tagged protocol, not chosen after the data, and no earlier entry chose one.

**Result.** The seed is the date the config was written, as PR 2's configs date theirs (`h1-gatemem-reach.json`'s audit seed 20261102); nothing else depends on its value.

**Consequence.** Part B may restate it in v1's Statistics section; changing it after the tag would be an amendment.
