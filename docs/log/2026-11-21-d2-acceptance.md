---
date: 2026-11-21
author: claude-agent
type: milestone
card: D2
chapter: evaluation
pillar: distill
hypothesis: H5
evidence:
  - fixtures/cassettes/d2-induce-fixture
  - research/configs/d2-induce-fixture.json
  - "make run CONFIG=research/configs/d2-induce-fixture.json"
supersedes: none
---

**What.** Card D2's acceptance passes. Two runs of `make run CONFIG=research/configs/d2-induce-fixture.json` each print "model calls: 0 new, 1 from cassettes".

**Why.** The card's acceptance.

**Result.** Ten examples, one skipped (verdict failure). AWM gives three candidates and rejects two workflows, one for a single action and one for calling `write`. The control gives one candidate. All four writes are allowed by `preset.medium/write/person`. skills-ref validates all four SKILL.md files with no error.

**Consequence.** Card D3 can replay these four candidates.
