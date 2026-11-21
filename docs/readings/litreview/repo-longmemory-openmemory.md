---
id: repo-longmemory-openmemory
title: LongMemory (formerly OpenMemory by CaviraOSS), a TypeScript temporal and governed memory engine
authors: CaviraOSS
venue: GitHub repository, verified 2026-11-21
year: 2026
tier: new
topics: [store, temporal, governance, typescript]
engram: [govern, plane, H2]
code: https://github.com/CaviraOSS/OpenMemory (renamed CaviraOSS/LongMemory)
sources_read: [https://github.com/CaviraOSS/OpenMemory (gh api, resolves to LongMemory), its README, npm registry lookup for longmemory and openmemory-js]
---

## Claim
LongMemory is a TypeScript-native, SQLite-backed memory engine that claims immutable content, provenance and temporal truth. It is the one candidate in this sweep that can be called in process from Node.

## Method
Repository: Apache-2.0, 4,585 stars, pushed 2026-11-10, language TypeScript. The README shows `createMemory()`, `ingest({user_id, text})` and `recall({text, mode})` with modes strict, historical, associative and grounded. Storage is in memory or SQLite (`store: 'sqlite'`, `db_path`), and reopening restores nodes, worlds, entities, edges, temporal history, grounding and lifecycle state. It also ships a CLI, HTTP, MCP, a dashboard and a VS Code extension. The npm package `longmemory` is at 1.3.3 (modified 2026-08-31) and depends on `sqlite3`. `openmemory-js` 1.3.3 is the older name and its npm metadata shows no licence field.

## Key numbers
None stated in the sources read.

## What Engram borrows
- The recall modes (strict, historical) as a vocabulary for as-of reads against Engram's validity windows.
- An in-process TypeScript store with temporal history is a candidate adapter that needs no server.

## What Engram does differently
Its governance sits inside the engine. Engram keeps the gate in the plane and would treat LongMemory as an untrusted bytes store.

## Risk to our claims
A young project mid-rename from one organisation. Its ingest path extracts entities and may need a model, so the adapter must prove it runs with that off. Native `sqlite3` is a build dependency.

## Open question
Does `ingest` accept a caller-supplied id and validity window, or does it always mint its own? The contract needs the first.

## Notes
Not read: the source, any benchmark. Checked 2026-11-21 with npm pack: the longmemory 1.3.3 tarball has no licence field and no LICENSE file, so only the GitHub repository states Apache-2.0.
