---
id: repo-mem0-v3-entity-linking
title: Mem0 OSS v3, graph memory removed, entity linking and single-pass add
authors: mem0ai
venue: migration guide, read 2026-11-21
year: 2026
tier: new
topics: [store, graph, retrieval]
engram: [plane, H2]
code: https://github.com/mem0ai/mem0
sources_read: [https://docs.mem0.ai/migration/oss-v2-to-v3, search results on the ts-v3.0.0 release notes]
---

## Claim
Mem0's open-source SDK no longer has graph memory. Version 3 stores entities in a parallel vector collection, fuses three retrieval signals and only adds, so Engram's Mem0 adapter sits on a store that no longer supersedes or deletes by itself.

## Method
The guide says `enable_graph`, `graph_store` and the Neo4j, Memgraph, Kuzu, Apache AGE and Neptune drivers are removed and `relations` is no longer returned. A `{collection}_entities` collection is created on first use. Search fuses semantic similarity, BM25 and entity overlap, and defaults changed (`top_k` 100 to 20, `threshold` none to 0.1, `rerank` true to false). `add()` is one LLM pass that is ADD-only, given the 10 nearest memories as context, drops exact duplicates by MD5 and returns only ADD events. Entity extraction needs spaCy (`mem0ai[nlp]`, Python), and without it search is semantic only. How the TypeScript package behaves was not confirmed.

## Key numbers
- The changed defaults above, from the guide. No accuracy numbers were read.

## What Engram borrows
- ADR 0013's description of Mem0 as ADD, UPDATE, DELETE, NOOP with a graph variant is out of date and needs an amendment.
- Because add never updates, the plane owns supersession for Mem0, which is the case ADR 0035 wants shown.

## What Engram does differently
Mem0 now leaves currency to ranking. Engram retires and records.

## Risk to our claims
The adapter pins mem0ai 3.3.1, and any later change to scoring shifts recall tests that are not lexical.

## Open question
Does the TypeScript package's entity step run without spaCy, and does it change which items search returns?

## Notes
Graph memory is now a hosted Platform feature only.
