---
date: 2026-10-25
author: claude-agent
type: finding
card: B1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/py.ts
  - packages/bench/scripts/upstream-edge-golden.py
  - fixtures/bench/gatemem/upstream-edge-golden.json
  - packages/bench/test/gatemem/edge.test.ts
  - packages/bench/scripts/check-gatemem-upstream.ts
  - "node packages/bench/scripts/check-gatemem-upstream.ts <upstream dir> <scores.json>"
supersedes: docs/log/2026-10-25-b1-gatemem-full-dataset-check.md
---

**What.** The superseded entry claimed the port's rule-based scores can stand in for upstream's; that held only for its inputs.

**Why.** Its synthetic answers were dataset text with an empty structured answer, so they never reached a model's floats, str() of a dict, or non-ASCII text against `\w`, `\s`, `\d` or `$`. On those, upstream's own code gave different text and hits: 26 of 54 crafted cases differed.

**Result.** With `py.ts`, all 57 edge cases match upstream's Python 3.14 output, all 91 regex-like dataset patterns compile in both, and the full-dataset check still gives 0 mismatches over 4,436 scores. Untranslatable constructs throw instead of matching differently.

**Consequence.** The claim now holds for the dataset's patterns and model output covered by the edge golden. Case folding and Unicode tables can still differ at the margins (Node 24 ships Unicode 17, CPython 3.14 Unicode 16).
