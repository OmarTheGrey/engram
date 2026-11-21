---
id: repo-google-adk-memory-service
title: Google ADK BaseMemoryService (Python and TypeScript)
authors: Google
venue: open-source library, 2025 to 2026
year: 2026
tier: new
topics: [framework, integration, store]
engram: [govern, twin]
code: https://github.com/google/adk-python
sources_read: [https://raw.githubusercontent.com/google/adk-python/main/src/google/adk/memory/base_memory_service.py, https://github.com/google/adk-js/blob/main/core/src/memory/base_memory_service.ts]
---

## Claim
ADK's memory service is a two-method interface keyed by app and user, a natural fit for a person-scope Twin.

## Method
Python `BaseMemoryService`: abstract async `add_session_to_memory(session)` and `search_memory(*, app_name, user_id, query) -> SearchMemoryResponse`; optional `add_events_to_memory`, `add_memory` and `delete_memory(memory_id)`, which raise NotImplementedError by default. ADK-JS has `BaseMemoryService` with `addSessionToMemory(session)` and `searchMemory(request)`, plus in-memory, Vertex AI Memory Bank and RAG implementations.

## Key numbers
- adk-python: Apache-2.0, 22,292 stars; adk-js: Apache-2.0, 1,488 stars; both pushed 2026-11-21.

## What Engram borrows
user_id maps to person scope with owner grants; add_session_to_memory is a Distill input (session to candidate items), not a direct write.

## What Engram does differently
ADK has no trust or provenance; Engram refuses lower-trust writes over higher-trust items.

## Risk to our claims
None specific; the interface is thin, so the adapter claims little.

## Open question
Does app_name map to a team scope, or to a tag on the item?

## Notes
The TypeScript implementation is cheaper for us since the generated client is TypeScript.
