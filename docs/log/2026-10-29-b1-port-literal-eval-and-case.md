---
date: 2026-10-29
author: claude-agent
type: finding
card: B1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/literal.ts
  - packages/bench/src/gatemem/py.ts
  - packages/bench/scripts/upstream-edge-golden.py
  - fixtures/bench/gatemem/upstream-edge-golden.json
  - packages/bench/test/gatemem/edge.test.ts
  - "node packages/bench/scripts/check-gatemem-upstream.ts <upstream dir> <scores.json>"
supersedes: docs/log/2026-10-25-b1-port-python-semantics.md
---

**What.** The superseded entry's claim that the port parses model output as upstream does held only for JSON replies; it did not say that upstream's `ast.literal_eval` fallback was not ported.

**Why.** The verifier ran upstream at a983828 on new replies: the 4 written as Python literals parsed differently (the raw text as the answer), and `(?i)istanbul` missed "İstanbul" (Python compares lowercase forms, JavaScript case folds).

**Result.** All 54 parse rows and 80 pattern rows of `upstream-edge-golden.json` now match Python 3.14.3; 11 rows throw instead (sets, bytes, complex numbers, Ellipsis, `\N{...}`, keys that are not str, back references under IGNORECASE). Of the verifier's 4, two match and two throw. The full-dataset check gives 0 mismatches over 2,218 checkpoints. An earlier golden pattern with a back reference had matched by chance and now throws; no dataset pattern has one.

**Consequence.** No known reply or pattern scores differently in silence.
