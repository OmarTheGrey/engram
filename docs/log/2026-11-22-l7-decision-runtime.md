---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/deps.md
  - packages/model/src/nli.ts
supersedes: none
---

**What.** Chose onnxruntime-node 1.31.1 with @huggingface/tokenizers 0.2.0 over transformers.js 4.3.2.

**Why.** The card leaves the runtime to the spike: whichever runs on Windows with no native build step.

**Result.** onnxruntime-node ships its Windows CPU binary in the tarball; its install script only fetches CUDA on Linux and is not run. transformers.js 4.3.2 would add sharp, onnxruntime-web and an older onnxruntime-node 1.30.0. The pure JavaScript tokenizer's pair encoding matched `[CLS] A [SEP] B [SEP]` built by hand on the spike's pairs, and the model card's two examples came out entailment and contradiction.

**Consequence.** If wrong, a later card swaps the runtime; the runtime string is in every cache key, so old scores would miss rather than mislead. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
