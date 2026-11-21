---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/bench/plane-overhead.ts
  - packages/core/test/bench/count.test.ts
supersedes: docs/log/2026-11-21-x15-decision-workload.md
---

**What.** Each cell of the suite, one (preset, op), runs on its own copy of a template populated once per store and size: the closed log file and the files adapter's folder are copied, and the fake's records are written into a fresh fake.

**Why.** Review finding X15-1: a shared store let run order decide the preset comparison. Populating anew per cell would cost nine populations. The fake keeps its records in memory, so its copy is a store-level copy like the folder copy, written with `Adapter.write` outside the plane, since the copied log already holds their events.

**Result.** A test runs the suite with presets `[medium, medium]` and asserts both runs of each op start from the same item and event counts and ask the same queries; it fails when cells share a store. Samples are kept in call order.

**Consequence.** Cells are comparable across presets and ops.
