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
The repository lists spans (inference, embeddings, retrieval, invoke_agent, execute_tool), events, exceptions and metrics. The agent-span page names memory among the provider kinds an agent may use, but I found no memory span definition in what I read. *(Corrected 2026-11-21: see the correction at the end.)*

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
Should Engram propose a `gen_ai.memory.*` span family upstream? *(Corrected 2026-11-21: see the correction at the end.)*

## Notes
A community proposal for memory spans exists but is not an official spec. *(Corrected 2026-11-21: see the correction at the end.)*

## Correction, 2026-11-21 (card E8.13)
The text above is kept as first written. It was read before the repository's first release. Release v0.1.0 of `open-telemetry/semantic-conventions-genai` (tag v0.1.0, commit d0e74ba6c48bcc4ded473b1828a8212f06b23753, published 2026-11-21, built on semantic conventions v1.45.0) defines a memory span, `gen_ai.memory.client`, in `docs/gen-ai/gen-ai-spans.md` (section Memory), Development status:
- Operations (`gen_ai.operation.name`): `create_memory_store`, `delete_memory_store`, `create_memory`, `update_memory`, `upsert_memory`, `search_memory` and `delete_memory`. The span is named `{gen_ai.operation.name}`, kind CLIENT, or INTERNAL for a memory system in the caller's process.
- Attributes: `gen_ai.memory.record.id` (conditionally required, when the operation applies to one record), `gen_ai.memory.store.id` (conditionally required), `gen_ai.memory.record.count` (recommended), `gen_ai.provider.name`, `server.address` and `server.port`, `error.type`, and two opt-in content attributes, `gen_ai.memory.records` and `gen_ai.memory.query.text`, which "SHOULD NOT" be captured by default.

So the three lines marked above no longer hold: a memory span is defined, it is official (Development status), and the open question is answered. Engram maps onto it (card E8.13, `packages/core/src/export/otel.ts`, ADR 0043), never sets the opt-in content attributes, and needs no proposal upstream for now. Also corrected: `sdk-trace-base` 2.12.0 refuses `@opentelemetry/api` 1.10.0 (its peer range is below 1.10.0), so E8.13 pins `@opentelemetry/sdk-trace` 3.1.0, the package's 3.x name, with exporter-trace-otlp-http 0.301.0, since 0.301.2 is under two weeks old until 2026-11-26 (`docs/deps.md`).
