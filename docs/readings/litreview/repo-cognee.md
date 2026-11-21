---
id: repo-cognee
title: cognee, a graph and vector memory engine with remember, recall, improve and forget
authors: topoteretes
venue: GitHub repository, verified 2026-11-21
year: 2026
tier: new
topics: [store, graph, mcp, lifecycle]
engram: [govern, plane, distill]
code: https://github.com/topoteretes/cognee
sources_read: [https://github.com/topoteretes/cognee (gh api: licence, stars, push date, release, directory listing), https://raw.githubusercontent.com/topoteretes/cognee/main/README.md, npm registry lookup for a cognee package (none found)]
---

## Claim
cognee is the most active open-source graph-first memory engine with a REST API and an MCP server. It is Python and its TypeScript story is an SDK over HTTP, so it can be reached by an HTTP adapter and not embedded.

## Method
Repository facts: Apache-2.0, 33,442 stars, pushed 2026-11-20, language Python, release v1.6.10 on 2026-11-18. The README names four operations, `remember`, `recall`, `improve` and `forget`, with `recall` routing automatically or by a chosen strategy. It says cognee runs locally with no API key, can run its whole memory layer on one Postgres instance since 1.0 (Postgres as a graph store is labelled a demo), ships a prebuilt API on port 8000 and an MCP server, and links a TypeScript SDK. The repository has `cognee-mcp`, `cognee-connectors` and `cognee-integrations`, and a separate `cognee-community` plugin repository (Apache-2.0, 112 stars). No npm package named `cognee` exists, so the SDK's package name was not found.

## Key numbers
- 33,442 stars, release v1.6.10 (gh api, 2026-11-21).
- The README gives no benchmark numbers in the part read.

## What Engram borrows
- The four-verb surface is a clean mapping target: write to `remember`, read to `recall`, retention to `forget`, promotion and consolidation to `improve`. An HTTP adapter would implement the Adapter contract over `remember`, `recall` and `forget`.
- Session memory distilled into permanent memory has the shape of Engram's candidate to active promotion; compare with ADR 0026.

## What Engram does differently
cognee's `forget` and `improve` change memory with no recorded reason or policy id. Engram would call them only from the plane, after a gate decision, and mirror each into the event log.

## Risk to our claims
The README does not describe temporal validity, so cognee would declare `native_validity: false` and add nothing to the bi-temporal tests. A third, structurally different store helps ADR 0035, but CI would need a Python server.

## Open question
Does cognee return stable ids per memory so that `write` can be idempotent per item id as the contract requires?

## Notes
Not read: the REST schema, the SDK source, the licence text beyond the GitHub SPDX field.
