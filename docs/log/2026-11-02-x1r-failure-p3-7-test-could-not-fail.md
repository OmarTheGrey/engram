---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/test/gatemem/rag-policy.test.ts
supersedes: none
---

**What.** The RAG-Policy hidden-field test stripped both checkpoints before the gate, so it could not fail; the first fix still passed a gate that read `leak_targets`, because the planted value named nothing the gate matches.

**Why.** The test compared two stripped checkpoints, then planted inert values.

**Result.** It now hands the gate the unstripped checkpoint with every principal and resource name planted in the hidden fields; a gate reading them fails it.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
