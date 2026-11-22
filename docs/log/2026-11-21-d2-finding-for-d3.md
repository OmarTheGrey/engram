---
date: 2026-11-21
author: claude-agent
type: finding
card: D2
chapter: discussion
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/runner/src/induce.ts
supersedes: none
---

**What.** `Plane.read` returns active items only, so a candidate cannot be read back through it. Card D3 gets candidates from `runInduceConfig`'s `items`, or from `candidates.jsonl` in the run folder, and promotes them by id.

**Why.** Card D3 is being built against this card's output.

**Result.** The fixture's candidates have item ids `01920000-0000-7000-8000-000000000001`, `...0002` and `...0003` (AWM) and `...0007` (the control) in the seed's log (`candidates.jsonl`), all of kind `compaction`, since examples hold branch summaries.

**Consequence.** None for D2.
