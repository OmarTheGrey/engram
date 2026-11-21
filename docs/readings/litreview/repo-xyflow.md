---
id: repo-xyflow
title: xyflow (React Flow) and companions for provenance graphs, tables and diffs
authors: xyflow contributors
venue: GitHub repository, 2026
year: 2026
tier: new
topics: [ui, graph, provenance, inspector]
engram: [govern, plane]
code: https://github.com/xyflow/xyflow
sources_read: [gh api repository metadata, npm registry metadata]
---

## Claim
@xyflow/react (MIT, 13.0.2, about 39.1k stars, pushed 2026-11-19) is the standard React node-graph component. With @dagrejs/dagre (MIT) for layout it can draw an item's supersession and derivation chain.

## Method
Metadata check only. We did not build with it or read its docs.

## Key numbers
- @tanstack/react-table 9.3.1 (MIT), @tanstack/react-virtual 3.14.26 (MIT), jsdiff "diff" 9.0.0 (BSD-3-Clause) (npm).
- elkjs is EPL-2.0 or GPL-3.0-or-later, so avoid it.

## What Engram borrows
A provenance graph over `lineage` and event links, a virtualised event table and a version diff for superseded items. Lands in AB-SUR-3.

## What Engram does differently
The UI computes no policy. The graph is drawn from events and explanations the server already returns.

## Risk to our claims
Bundle size and a new dependency set in a UI that has only React and openapi-fetch today. The graph must read only what the viewer may see, or it becomes a read-filter leak.

## Open question
What edges exist in the log beyond supersedes? Only the `lineage` field (ids of superseded versions) was found in schema.ts.

## Notes
shadcn/ui (MIT, 128.7k stars) is copy-in code on Radix and Tailwind, so it is not a dependency.
