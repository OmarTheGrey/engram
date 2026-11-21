---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: evaluation
pillar: research
hypothesis: H5
evidence:
  - research/configs/b11-tau2-fixture.json
  - fixtures/tau2/script.json
  - packages/bench/PINS.md
supersedes: none
---

**What.** The fixture slice is airline tasks 6, 19 and 16 of tau2's test split, seed 1, under C1, C2 and C5 at preset medium. The scripted agent solves 6 (a read only) and 19 (cancel Z7GOZK) and fails 16 (no update), so the reward is seen at 1 and at 0. The script sits beside B5's in `fixtures/bench/tau2/`.

**Why.** Airline's reward basis is DB and COMMUNICATE on all 50 tasks, both deterministic, so tau2's own full reward needs no model judge; retail's is DB and NL_ASSERTION on 112 of 114, whose NL part is a `gpt-4.1` judge. Three tasks exercise a memory read with no match, writes C5 denies and allows, and a reply mixing a memory write with a domain call.

**Result.** 62 cassettes, 1.4 MB, recorded from the scripted upstream only.

**Consequence.** A retail run reports the database hash check (EvaluationType.ENV) and calls no judge.
