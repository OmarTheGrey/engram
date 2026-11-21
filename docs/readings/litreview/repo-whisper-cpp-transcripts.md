---
id: repo-whisper-cpp-transcripts
title: whisper.cpp and Node bindings for audio transcript memory
authors: ggml-org; community binding authors
venue: repositories
year: 2026
tier: new
topics: [ingestion, multimodal, audio, provenance]
engram: [twin, govern]
code: https://github.com/ggml-org/whisper.cpp
sources_read: [gh api metadata, search results on npm bindings]
---

## Claim
Audio can enter memory as a timestamped transcript, each segment a span with start and end seconds, with the audio hash as the source hash.

## Method
Metadata and package listings only.

## Key numbers
- ggml-org/whisper.cpp: MIT, 55,383 stars, pushed 2026-11-20, C++; its bindings folder lists javascript, go, java and ruby.
- huggingface/transformers.js: Apache-2.0, 16,439 stars (see repo-transformers-js). k2-fsa/sherpa-onnx: Apache-2.0, 16,074 stars.
- npm wrappers seen (nodejs-whisper, nwhisper, whisper-cpp-node) are small third-party packages. Licences, upkeep and word-timestamp output were not verified.

## What Engram borrows
Transcript segments as chunks with a time-range selector; the transcript is derived content, so kind `tool`, with the audio hash as provenance hash.

## What Engram does differently
Twin treats voice as personal data: a recording enters only the speaker's person scope.

## Risk to our claims
ASR is a model call. It must be cached and seeded, or stay outside the plane as a user-run step whose output is imported.

## Open question
Is audio worth a card before the thesis deadline, or a documented extension point only?

## Notes
Use whisper.cpp as an external program the user runs, not a dependency of the repo.
