---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - packages/runner/src/gatemem-probe.ts
  - packages/runner/test/x1-gatemem.test.ts
supersedes: docs/log/2026-11-02-x1-c4-shows-the-verdict.md
---

**What.** C4's `access` verdict on GateMem comes by default from the plane's own read decision under the preset C5 enforces (core's `evaluateRead`); GateMem's RAG-Policy verdict is a second source chosen with `c4_verdicts: "gatemem-rag"`. ADR 0031 is rewritten.

**Why.** The RAG-Policy gate is a different policy from C5's (finding P3-2; the agreement is in the next entry), so C4 minus C5 would mix policy and mechanism; H1 tests the mechanism.

**Result.** A test runs C5's plane and checks that every item C4 calls allowed is one C5's read returns, and no other; making every verdict allowed fails three tests. H1's GateMem config and the fixture probe use `engram`; the suite's `x1-h1-gatemem-rag` arm keeps the second source recorded.

**Consequence.** The lead chooses the source on PR 4's decision sheet.
