---
date: 2026-11-19
author: claude-agent
type: change
card: L2
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - fixtures/bench/longmemeval-faults/README.md
  - fixtures/bench/longmemeval-faults/labels.jsonl
  - packages/bench/scripts/fault-set.ts
  - packages/bench/test/faults/fixture.test.ts
  - "node packages/bench/scripts/fault-set-check.ts --set fixtures/bench/longmemeval-faults"
supersedes: none
---

**What.** A fixture-size fault set, the generator run on B5's vendored 20-question subset under H3's seed and count, committed in `fixtures/bench/longmemeval-faults/` and regenerated only by `make fixtures`.

**Why.** The plan asks for a set built from B5's committed subset to back the tests, so the full split is never needed offline or in CI.

**Result.** 20 states (1.2 MB of events) and 360 labels: 180 faults and 180 near-misses. A golden test holds the four files byte for byte against the generator. The check script reports 100 of 100 keyed faults flagged by their expected lint, 0 near-misses flagged, 0 unlabelled findings of a measured lint, 0 duplicate findings.

**Consequence.** L3 and L4 can lint this set in tests without fetching LongMemEval's S split.
