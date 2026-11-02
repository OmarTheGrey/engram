---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/test/gatemem/rag-policy-full.test.ts
supersedes: none
---

**What.** `make test` held the RAG-Policy port to 20 checkpoints only, which a billing-role mutation passed, and a log entry claimed a change to the port fails the golden test.

**Why.** The full-set comparison was a development-time script outside the test suite.

**Result.** A full-set golden runs inside `make test` when the data is present; a superseding entry corrects the claim.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
