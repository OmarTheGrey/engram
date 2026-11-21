---
id: repo-vercel-ai-sdk-middleware
title: Vercel AI SDK language model middleware
authors: Vercel, Inc.
venue: open-source library, 2024 to 2026
year: 2026
tier: new
topics: [framework, integration, middleware, recall]
engram: [govern, plane]
code: https://github.com/vercel/ai
sources_read: [https://ai-sdk.dev/docs/ai-sdk-core/middleware]
---

## Claim
The AI SDK exposes one typed middleware seam around any language model, enough to inject governed recall into the prompt and to write governed memories from the response.

## Method
A middleware is an object of type `LanguageModelV4Middleware` (from `@ai-sdk/provider`; the docs read on 2026-11-21 show `specificationVersion: 'v4'`) with optional `transformParams({ params })`, `wrapGenerate({ doGenerate, params, model })` and `wrapStream({ doStream, params })`. `wrapLanguageModel({ model, middleware })` applies it, and an array chains, `[first, second]` giving `first(second(model))`. The docs print no formal hook signatures; the shapes come from their examples.

## Key numbers
- vercel/ai: 28,117 stars, pushed 2026-11-21. The LICENSE file is Apache-2.0 (Copyright 2023 Vercel, Inc.), though GitHub reports NOASSERTION. npm `ai` 7.0.179.

## What Engram borrows
transformParams as the read filter: recall through Plane.read and prepend admitted items as a tagged block (the shared memory tag, tag.ts). wrapGenerate and wrapStream (on finish) as the write path for extracted memories. Lands in AB-FWK-3.

## What Engram does differently
The middleware sees the model call, not the app's other tools; it governs what enters the context but cannot stop an app writing elsewhere. Same limit as condition C7.

## Risk to our claims
The spec version has changed across majors, so the middleware can break on upgrade. Pin the peer range and test two majors.

## Open question
Is the write path better driven by explicit tools (visible, governed) or by post-hoc extraction from the response (needs a ModelCall injected under rule 4)?

## Notes
A `memory` tool set built from the same MEMORY_* definitions as the MCP server gives the explicit path.
