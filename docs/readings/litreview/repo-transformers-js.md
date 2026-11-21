---
id: repo-transformers-js
title: Transformers.js, in-process ONNX models for JavaScript
authors: Hugging Face
venue: GitHub repository
year: 2026
tier: new
topics: [embeddings, onnx, local, reranker]
engram: [plane]
code: https://github.com/huggingface/transformers.js
sources_read: [gh api repos/huggingface/transformers.js, npm view @huggingface/transformers, huggingface.co/api/models]
---

## Claim
Runs embedding and cross-encoder models locally in Node through ONNX Runtime, with no server.

## Method
Metadata only: Apache-2.0, 16,439 stars, pushed 2026-11-18, npm @huggingface/transformers 4.3.2 (modified 2026-10-30). Model licences from the Hugging Face API: bge-small-en-v1.5 MIT, gte-small MIT, nomic-embed-text-v1.5 Apache-2.0, all-MiniLM-L6-v2 Apache-2.0, bge-reranker-base MIT, Qwen3-Embedding-0.6B Apache-2.0. EmbeddingGemma carries the Gemma licence and is not absorbable. Quality of each model not measured.

## Key numbers
- Stars 16,439; npm 4.3.2 (gh api and npm view, 2026-11-21).

## What Engram borrows
An embedder function injected at the adapter boundary: text to a fixed-size vector, with model id and revision recorded and every vector cached by content hash. Lands in AB-RET-3.

## What Engram does differently
Core never imports it. Only an adapter-side package calls it, and its output reaches core as data.

## Risk to our claims
Weights download once and must be pinned by revision and hash. The cache key must include model revision (rules 6 and 7).

## Open question
Are ONNX CPU outputs bit-identical across Windows and Linux? If not, fixtures must freeze vectors.

## Notes
fastembed on npm (3.0.0, MIT, Anush008/fastembed-js, 177 stars) is a thinner alternative for the same job.
