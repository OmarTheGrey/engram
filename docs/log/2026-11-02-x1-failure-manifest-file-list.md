---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/mem-inv-bench/load.test.ts
  - fixtures/bench/mem-inv-bench/manifest.json
supersedes: none
---

**What.** After the vendoring wrote the full case set, card B4's test of the MEM-INV-Bench manifest failed: it lists the vendored files exactly, and `full/cases.jsonl` was new.

**Why.** The test pins the manifest's file list so an unlisted file cannot slip past `engram doctor`; adding a vendored file has to update it.

**Result.** The list now names `full/cases.jsonl`, and the same test checks its 38 line hashes; doctor hashes it through the manifest with no change to doctor.

**Consequence.** None.
