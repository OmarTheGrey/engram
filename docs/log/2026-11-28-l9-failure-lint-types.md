---
date: 2026-11-28
author: claude-agent
type: failure
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/lint/evidence.test.ts
  - research/scripts/l9_grounding.py
  - "make lint"
supersedes: none
---

**What.** `make lint` failed twice: tsc on the test helper `derived` in `evidence.test.ts`, and mypy on an untyped lambda in `l9_grounding.py`.

**Why.** The helper's override was typed `Partial<MemoryItem>`, whose `class` admits procedural, which `item` refuses; the lambda carried no annotations, so mypy's strict mode refused each call.

**Result.** The override is typed as the two fields it sets, and the lambda is a typed function. tsc and mypy pass; the evidence test passes 24 of 24 and the result regenerates to sha256 `da311b42...00f5`, unchanged.

**Consequence.** None.
