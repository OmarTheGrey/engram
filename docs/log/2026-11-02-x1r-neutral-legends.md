---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/gatemem-probe.ts
  - packages/runner/test/x1.test.ts
supersedes: none
---

**What.** C4's GateMem legend names no benchmark and states that a verdict depends on who is asking; a test checks that no condition's request on either arm contains GateMem, MEM-INV, benchmark or baseline.

**Why.** The first legend called the verdict "GateMem's ... the benchmark's RAG-Policy baseline", an evaluation cue only C4 carried (finding P3-3).

**Result.** One legend serves both verdict sources. Adding "baseline" to it fails the test; the judge's requests, the scorer's, are left out of the check.

**Consequence.** C4's cassettes were recorded again.
