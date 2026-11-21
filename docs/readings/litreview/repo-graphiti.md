---
id: repo-graphiti
title: Graphiti, the open-source temporal knowledge graph engine behind Zep
authors: Zep AI (getzep)
venue: GitHub repository, verified 2026-11-21
year: 2026
tier: new
topics: [store, temporal, graph, provenance]
engram: [govern, plane, H2, H4]
code: https://github.com/getzep/graphiti
sources_read: [https://github.com/getzep/graphiti (gh api: licence, stars, push date, directory listing), https://raw.githubusercontent.com/getzep/graphiti/main/README.md, graphiti_core/edges.py (field names), https://help.getzep.com/graphiti/configuration/kuzu-db-configuration (search snippet only)]
---

## Claim
Graphiti is the maintained, Apache-2.0 implementation of the bi-temporal fact graph that the Zep paper (2501.13956) describes. It is Python and needs a graph database server, and it has no TypeScript client, so Engram can port its data model but cannot embed it.

## Method
Verified from the repository: Apache-2.0, 32,972 stars, last push 2026-11-20, language Python. Raw ingested data are episodes, facts are entity-relationship-entity edges, entities carry evolving summaries, communities are optional. An edge (graphiti_core/edges.py) has `fact`, `fact_embedding`, `episodes` (the supporting episode ids), `valid_at`, `invalid_at`, `expired_at` and `created_at`, and nodes and edges carry a `group_id` that partitions the graph. Facts are invalidated, never deleted. Retrieval fuses embeddings, BM25 and graph traversal. The README lists Neo4j 5.26, FalkorDB 1.1.2 and Amazon Neptune. The `graphiti_core/driver` folder holds `neo4j`, `falkordb` and `neptune` and no Kuzu driver on the day read, although a docs page found by search still describes one. The repository ships a reference FastAPI `server/` and an MCP `mcp_server/`; the README says they have "no authentication, no authorization, and no prompt-injection protection".

## Key numbers
- 32,972 stars, pushed 2026-11-20 (gh api, 2026-11-21).
- Benchmark numbers are in 2501.13956 and are not repeated. None were read from the repository itself.

## What Engram borrows
- The edge model as the shape of a native-validity store: a fact with a world-time window (`valid_at`, `invalid_at`), a system-time pair (`created_at`, `expired_at`) and the episode ids that support it. These map to Engram's `valid_from`, `valid_to`, `lineage` and `provenance`.
- `group_id` as the partition key maps to an Engram scope, so a graph adapter can refuse cross-scope reads at the store as well as in the plane.
- Concurrent ingestion per group and a configurable prompt library are ideas for the model-based lints, not code to vendor.

## What Engram does differently
Graphiti decides invalidation with an LLM inside ingestion and records no reason. Engram would let the store hold the window but keep the decision in the plane, as an event with a reason and a policy id. The adapter never calls a model.

## Risk to our claims
Reachability outside Python is poor. Neo4j's server licence was not checked in this pass and should be treated as not absorbable until read. FalkorDB's GitHub licence field reads NOASSERTION, so it is not absorbable until read, and the embedded FalkorDBLite needs Python 3.12 or later. A claim that Engram "supports Zep" would in practice mean a Python sidecar or Zep Cloud.

## Open question
Is a Graphiti-shaped store worth building natively on SQLite or LadybugDB, or does the thesis only need the contract's native_validity path exercised by a faithful fake?

## Notes
Zep Cloud has an npm client, `@getzep/zep-cloud` 4.1.0 (modified 2026-11-02; npm shows no licence field, so unverified). Kuzu, the embedded graph database Graphiti once used, is archived (last push 2025-10-10). The MIT fork LadybugDB (`@ladybugdb/core` 0.22.3, repository pushed 2026-11-21) is the live in-process option for Node.
