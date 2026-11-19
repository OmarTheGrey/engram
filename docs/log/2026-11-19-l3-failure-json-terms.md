---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/lint/model.test.ts
  - packages/core/src/lint/model.ts
supersedes: none
---

**What.** Pairing contradiction candidates by the core retrieval pipeline's terms (queryTerms: whitespace-separated words, edge punctuation removed) found no shared term between a text item and a structured one.

**Why.** The first implementation reused queryTerms for the candidate filter.

**Result.** The test "content is sent as JSON data" got no unit: canonical JSON splits on whitespace into tokens such as `freeze","z":1`, which never equal a word.

**Consequence.** The lint uses its own terms, runs of letters and digits lower-cased, which read text and JSON alike; the retrieval pipeline is unchanged.
