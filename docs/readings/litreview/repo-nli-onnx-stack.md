---
id: repo-nli-onnx-stack
title: "Local NLI in Node: transformers.js, onnxruntime-node and DeBERTa NLI models"
authors: Hugging Face, Microsoft, cross-encoder and MoritzLaurer model authors
venue: open-source tooling
year: 2026
tier: new
topics: [contradiction, nli, onnx, dependency]
engram: [govern, plane, H3]
code: https://github.com/huggingface/transformers.js (Apache-2.0, 16,439 stars, last push 2026-11-18, checked with gh api)
sources_read: [https://registry.npmjs.org/@huggingface/transformers, https://registry.npmjs.org/onnxruntime-node, https://huggingface.co/api/models/cross-encoder/nli-deberta-v3-small, https://huggingface.co/api/models/cross-encoder/nli-deberta-v3-base, https://huggingface.co/api/models/Xenova/nli-deberta-v3-xsmall]
---

## Claim
A DeBERTa-v3 NLI cross-encoder can run in Node through ONNX with no Python and no Docker, and gives an entailment, neutral, contradiction distribution for a pair of statements.

## Method
Registry and model metadata only. No inference was run. npm: @huggingface/transformers 4.3.2 (Apache-2.0, published 2026-10-27), onnxruntime-node 1.31.1 (MIT, 2026-10-26). Hub: cross-encoder/nli-deberta-v3-small and -base are Apache-2.0 with an onnx tag. Xenova/nli-deberta-v3-xsmall has transformers.js ONNX files (int8, q4, fp16) and no licence tag on its card (check the base model). MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli is MIT.

## Key numbers
- Hub downloads: nli-deberta-v3-small 332,873; nli-deberta-v3-base 216,323 (Hub API, 2026-11-21).
- A search snippet says the base model was trained on MNLI and SNLI; not verified here.

## What Engram borrows
A middle contradiction tier: a pinned model file hashed in the policy, CPU inference, deterministic for fixed weights and runtime.

## What Engram does differently
Core imports no inference library. The scorer is injected as a function, like ModelCall, so core stays free of a native dependency.

## Risk to our claims
Training-data licences: MoritzLaurer's model names ANLI, which is CC-BY-NC, so prefer MNLI and SNLI only models and state it in the thesis. onnxruntime-node adds native binaries.

## Open question
Is the output byte-identical across CPU architectures? If not, the lint is deterministic per machine only, and cache keys must include the runtime version.

## Notes
Model files are fetched at run time. A sha256 pin and a local cache, as for upstream benchmarks in PINS.md, is the Engram answer.
