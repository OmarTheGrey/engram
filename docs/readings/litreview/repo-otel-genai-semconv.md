---
id: repo-otel-genai-semconv
title: OpenTelemetry GenAI semantic conventions (semantic-conventions-genai)
authors: OpenTelemetry GenAI SIG
venue: open-source specification, built on semantic conventions v1.45.0
year: 2026
tier: new
topics: [observability, tracing, standard]
engram: [plane, govern]
code: https://github.com/open-telemetry/semantic-conventions-genai
sources_read: [https://github.com/open-telemetry/semantic-conventions-genai, docs/gen-ai/gen-ai-agent-spans.md in that repository]
---

## Claim
There is a vendor-neutral vocabulary for agent traces: `invoke_agent`, `execute_tool`, inference and retrieval spans with `gen_ai.*` attributes, including `gen_ai.request.seed`. The agent-span page is marked Development, not Stable.

## Method
The repository lists spans (inference, embeddings, retrieval, invoke_agent, execute_tool), events, exceptions and metrics. The agent-span page names memory among the provider kinds an agent may use, but I found no memory span definition in what I read.

## Key numbers
- Apache-2.0, 556 stars, pushed 2026-11-21 (GitHub API).
- npm, Apache-2.0: @opentelemetry/api 1.10.0, sdk-trace-base 2.12.0, exporter-trace-otlp-http 0.301.2, semantic-conventions 1.45.0 (npm view, 2026-11-21).

## What Engram borrows
A mapping from each MemoryEvent to a span: a read becomes a retrieval span, a tool call an `execute_tool` span, a session an `invoke_agent` span. Decision, reason and policy_id go in an `engram.*` namespace; `gen_ai.request.seed` carries rule 6's seed.

## What Engram does differently
The event log stays the source of truth. Spans are a derived export and carry no memory content by default (rule 12).

## Risk to our claims
Attribute names may change while the spec is Development. Pin the version and keep the mapping in one file.

## Open question
Should Engram propose a `gen_ai.memory.*` span family upstream?

## Notes
A community proposal for memory spans exists but is not an official spec.
