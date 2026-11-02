---
date: 2026-11-02
author: claude-agent
type: change
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - fixtures/bench/gatemem/upstream-rag-policy-full.json
  - packages/bench/test/gatemem/rag-policy-full.test.ts
  - docs/log/2026-11-02-x1-rag-policy-port.md
supersedes: docs/log/2026-11-02-x1-rag-policy-port.md
---

**What.** The RAG-Policy port is held to upstream on GateMem's whole pinned set inside `make test` when the pinned data is present: a compact golden of per-checkpoint hashes from upstream's own agent, and a test that skips, saying why, when the data is absent.

**Why.** The earlier entry said a change to the port fails the golden test; on the 20 fixture checkpoints a mutation of the billing role passed it (finding P3-5). This entry corrects that sentence.

**Result.** The full-set test fails on that mutation and passes on the port: 2,218 checkpoints, 0 mismatches. The golden is 234 KB.

**Consequence.** A change to the port is caught where the data is present; CI, without it, still runs the fixture golden.
