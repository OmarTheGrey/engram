---
id: repo-graphiti-edge-invalidation
title: "Graphiti edge resolution and temporal invalidation (code read)"
authors: Zep (getzep)
venue: open-source repository
year: 2026
tier: new
topics: [temporal, contradiction, supersession, store]
engram: [govern, plane, H3]
code: https://github.com/getzep/graphiti (Apache-2.0, 32,972 stars, last push 2026-11-20, Python, checked with gh api)
sources_read: [https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/utils/maintenance/edge_operations.py]
---

## Claim
Graphiti decides duplicates and contradictions with one small-model call per new edge, then sets validity dates by deterministic interval logic with no model.

## Method
Read of edge_operations.py through a summarising fetch, not line by line. resolve_extracted_edges does an exact in-batch dedupe, retrieves duplicate and invalidation candidates by hybrid search, makes one call (dedupe_edges.resolve_edge) that only returns candidate indices, then _apply_temporal_invalidation and resolve_edge_contradictions set invalid_at and expired_at from the candidates' valid_at.

## Key numbers
none stated in the sources read.

## What Engram borrows
The split: a model picks which items conflict and a pure function proposes valid_to from valid_from ordering and interval overlap. The second half is deterministic and belongs in core as a supersession helper. (This complements repo-graphiti.md, which covers the store, not this code path.)

## What Engram does differently
Engram never edits in place. A proposed valid_to becomes a governed update event with the policy id and a reason.

## Risk to our claims
When a candidate starts later, Graphiti expires the new edge instead. Engram must route that case to review, not retire silently.

## Open question
How often does the date logic act on a model-extracted valid_at that is wrong?

## Notes
Python only, so this is a port of a small amount of interval logic, not a dependency. The read was by a summariser; re-read the source before porting.
