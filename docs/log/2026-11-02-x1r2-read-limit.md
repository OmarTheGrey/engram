---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/conditions.ts
  - research/configs/h1-gatemem.json
supersedes: docs/log/2026-11-02-x1r-one-ordering-rule.md
---

**What.** Every condition's read returns at most 20 items, ranked by core's `rankForRead`, each item scored on its own; `read_limit: 20` stands in both H1 configs.

**Why.** GateMem's RAG-Policy baseline retrieves the top 20 at the pin (`configs/runs/paper_main.yaml`, `top_k: 20`), so a read costs about what the benchmark's own retrieval puts in a prompt; without a cap a question matching 115 turns would send all of them, every call.

**Result.** With the cap C5's list need not be a subset of C2's, by design: the admitted items' top 20 is not everything's top 20, and the retrieval test sees such reads.

**Consequence.** The lead may change the limit on PR 4's decision sheet; every cassette key moves with it.
