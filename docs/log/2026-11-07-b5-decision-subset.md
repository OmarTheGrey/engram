---
date: 2026-11-07
author: claude-agent
type: decision
card: B5
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/vendor-longmemeval.ts
  - fixtures/bench/longmemeval/manifest.json
  - "node packages/bench/scripts/vendor-longmemeval.ts --upstream .engram/upstream/longmemeval --fetch --out fixtures/bench/longmemeval"
supersedes: none
---

**What.** The LongMemEval fixture is 20 questions of the oracle release, two per category (question type, with `+abstention`), drawn with seed 20261107 among records of at most 12,000 bytes, falling back to a category's smallest records; the scripted reader answers the first pick of each category with upstream's answer and the second with "I don't know.", and the scripted judge says yes exactly to upstream's answer and to abstentions.

**Why.** The card needs a category breakdown, so every category is present; the oracle file keeps only evidence sessions, so the fixture stays small (about 318 KB) while running the same code path as the 115k-token S file would. The scripted replies make the pipeline meet both judge labels.

**Result.** Vendoring from an empty folder with `--fetch` gave byte-identical files.

**Consequence.** The full sets (S, M) are not vendored; the live baseline names its set in the pre-registration.
