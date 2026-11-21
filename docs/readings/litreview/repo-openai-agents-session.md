---
id: repo-openai-agents-session
title: OpenAI Agents SDK Session protocol (Python and JS)
authors: OpenAI
venue: open-source library, 2025 to 2026
year: 2026
tier: new
topics: [framework, integration, sessions, episodic]
engram: [govern, plane]
code: https://github.com/openai/openai-agents-python
sources_read: [https://raw.githubusercontent.com/openai/openai-agents-python/main/src/agents/memory/session.py]
---

## Claim
Sessions in the OpenAI Agents SDK are a four-method conversation-history protocol, small enough to wrap, but they hold episodic history, not long-term memory.

## Method
Python `Session` is a Protocol with `session_id`, optional `session_settings`, and async `get_items(limit)`, `add_items(items)`, `pop_item()` and `clear_session()`; the `SessionABC` docstring tells third parties to implement the Protocol. An optional `OpenAIResponsesCompactionAwareSession` adds `run_compaction`. The JS repo (openai-agents-js) has memory/session.ts and memorySession.ts; its `Session` interface has `getSessionId`, `getItems`, `addItems`, `popItem` and `clearSession` (checked 2026-11-21).

## Key numbers
- openai-agents-python: MIT, 30,793 stars, pushed 2026-11-21. openai-agents-js: MIT, 4,031 stars.

## What Engram borrows
Episodic items written through the gate with provenance kind `tool` or `user`; Engram's existing `compaction` provenance kind for run_compaction output.

## What Engram does differently
Session items are model input items, not memories; governing every turn adds latency. Govern what is promoted, and Distill's extraction.

## Risk to our claims
Gating every turn may be too slow or noisy for H1-style measurement.

## Open question
Should sessions be governed at all, or only the extraction from them?

## Notes
Only the Python protocol is verified.
