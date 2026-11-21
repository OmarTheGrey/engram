---
id: repo-langgraph-basestore
title: LangGraph BaseStore (long-term memory interface, Python and JS)
authors: LangChain Inc.
venue: open-source library, 2024 to 2026
year: 2026
tier: new
topics: [store, framework, integration, namespaces]
engram: [govern, twin, plane]
code: https://github.com/langchain-ai/langgraph
sources_read: [https://reference.langchain.com/python/langgraph.store/base/BaseStore, https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint/langgraph/store/base/__init__.py, https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint/src/store/base.ts]
---

## Claim
LangGraph's long-term memory is a namespaced key-value store behind one abstract method, `batch`, so a single subclass can govern every read and write an agent graph makes.

## Method
`BaseStore` (Python `langgraph.store.base`, JS `@langchain/langgraph-checkpoint`) takes a list of operations: `GetOp(namespace, key, refresh_ttl)`, `SearchOp(namespace_prefix, filter, limit, offset, query, refresh_ttl)`, `PutOp(namespace, key, value|None, index, ttl)` and `ListNamespacesOp(match_conditions, max_depth, limit, offset)`. Only `batch` and `abatch` are abstract in Python; `get`, `search`, `put`, `delete` (a PutOp with value None) and `list_namespaces` are wrappers. Namespaces are tuples of strings, values are JSON dicts, `Item` carries `created_at` and `updated_at`, and `SearchItem` adds `score`. A store sets `supports_ttl` to accept TTL. The JS class has the same shape with an abstract `batch`. Graphs receive the store through `compile(store=...)`.

## Key numbers
- langchain-ai/langgraph: MIT, 45,222 stars, pushed 2026-11-20 (gh api, 2026-11-21).
- langchainjs: MIT, 18,354 stars. npm @langchain/langgraph-checkpoint 1.2.3 (npm view).

## What Engram borrows
The namespace tuple maps onto an Engram scope (("person","omar") to `person:omar`, ("org",) to `org`). A put is a governed write, a search is a governed read, and the decision event's reason is surfaced to the caller. Lands in report plan AB-FWK-2.

## What Engram does differently
BaseStore has no actor, no provenance and no refusal result: a put the gate denies must still return, so the adapter raises a typed rejection or records it and exposes the event. Engram binds the actor at construction, not per call.

## Risk to our claims
Nodes can keep state in graph state or a checkpointer, channels the store never sees. We state this as a limit, as ADR 0022 does for MCP.

## Open question
Should a denied put raise, or return silently with the event recorded? Raising is honest; silent success matches what callers expect.

## Notes
Engram has no get-by-key or list-namespaces route yet; the adapter needs one (AB-FWK-1). Version read: main on 2026-11-21.
