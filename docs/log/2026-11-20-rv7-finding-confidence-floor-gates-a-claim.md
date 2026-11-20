---
date: 2026-11-20
author: claude-agent
type: finding
card: RV7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The write rule's confidence floor compares `item.confidence`, a number the writer chooses, with the rule's floor. A model-sourced write passes any floor by claiming 1 (core review finding RV-CORE-8).

**Why.** The review asked that this be recorded for the lead, with the behaviour unchanged.

**Result.** `evaluateWrite` (`packages/core/src/policy/evaluate.ts`, the `below-floor` check) reads the item's own field. Nothing in the plane derives or caps it by source. The twin profile's floors (0.3 person, 0.6 role, 0.7 team, 0.8 org) therefore stop only a writer that reports low confidence honestly. Source isolation and the source lists, not the floor, are what keep model content out of shared scopes.

**Consequence.** A backlog row, "Confidence the model chooses". The thesis should not describe the floor as a guard against a model's overconfidence.

