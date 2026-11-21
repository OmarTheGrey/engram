---
id: repo-openai-agents-tracing
title: OpenAI Agents SDK tracing (openai-agents-js and openai-agents-python)
authors: OpenAI
venue: repositories, 2026
year: 2026
tier: new
topics: [procedural, store, methods]
engram: [distill, plane]
code: https://github.com/openai/openai-agents-js (MIT, TypeScript, 4,031 stars, pushed 2026-11-20); https://github.com/openai/openai-agents-python (MIT, 30,793 stars, pushed 2026-11-21)
sources_read: [https://openai.github.io/openai-agents-js/guides/tracing/ (first 100,000 characters, which were mostly API reference names; the guide body was not captured), gh api repository metadata]
---

## Claim
The SDK records each run as a trace of typed spans and has a processor interface, so a local consumer can read traces without the hosted exporter.

## Method
From API names only: `Trace` and `Span`; span data for agents, generations, function calls, handoffs, guardrails, MCP tool listings and custom spans; `TracingProcessor`, `BatchTraceProcessor`, `addTraceProcessor`, `setTraceProcessors`, `setTracingDisabled`, `setSensitiveDataLoggingEnabled`, `ConsoleSpanExporter`. Behaviour was not read.

## Key numbers
none stated in the sources read.

## What Engram borrows
A second session source for the distiller. `Session` in core is plain data, so a converter from spans to `SessionEntry` lets Distill mine OpenAI-SDK agents without pi. A TypeScript processor writing local JSONL needs no network.

## What Engram does differently
Pi's session tree has branches that carry the abandoned-attempt signal (ADR 0012). Spans are a flat list with handoffs, so there is no direct negative-example signal.

## Risk to our claims
Unverified: span payload fields, whether tool outputs are truncated, processor ordering. Plan no more than a spike.

## Open question
Which span fields give a tool call, its arguments and its result in a stable form?

## Notes
Low priority for H5, which runs on pi. The existing note repo-openai-agents-session covers sessions as memory, not traces.
