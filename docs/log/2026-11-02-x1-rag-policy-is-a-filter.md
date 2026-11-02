---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/gatemem/rag-policy.ts
  - "python -I packages/bench/scripts/upstream-rag-policy-golden.py --upstream .engram/upstream/gatemem --data .engram/upstream/gatemem/bench/data --out .engram/bench/rag-policy-full.json"
  - "node packages/bench/scripts/check-rag-policy-upstream.ts .engram/upstream/gatemem/bench/data .engram/bench/rag-policy-full.json"
supersedes: none
---

**What.** GateMem's RAG-Policy baseline is a deterministic filter before the model, not "the model decides from the metadata" as the pre-registration's C4 row says, and it reads no hidden field.

**Why.** Plan decision 4 assumed the agent attaches policy metadata for the model; the code at `a983828` drops every chunk its hand-written per-role and per-relationship gate refuses, then retrieves the top k of the rest.

**Result.** Rerunning upstream's gate with every hidden checkpoint field changed moved nothing on 2,218 of 2,218 checkpoints. The gate allows 126,653 of the 325,530 turn chunks up to their checkpoints (39 percent; the check command above prints both).

**Consequence.** C4 shows the verdict instead of filtering (ADR 0031); v1 must say C4's GateMem numbers are not upstream's RAG-Policy numbers.
