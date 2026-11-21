---
id: repo-supermemory
title: Supermemory, a hosted memory API with a local mode and a TypeScript SDK
authors: supermemoryai
venue: GitHub repository, verified 2026-11-21
year: 2026
tier: new
topics: [store, profile, import, typescript]
engram: [twin, plane]
code: https://github.com/supermemoryai/supermemory
sources_read: [https://github.com/supermemoryai/supermemory (gh api), its README, npm registry lookup for supermemory and @supermemory/tools]
---

## Claim
Supermemory is a large TypeScript-first memory project (31,680 stars, MIT repository, pushed 2026-11-21) and a good fit for Twin's person-profile idea. The engine is hosted, and the README does not say the core is open source.

## Method
The README names `client.add()`, `client.profile()` and `client.search()` with `searchMode`, scoping by `containerTag`, and wrappers for several agent frameworks. `npx supermemory local` runs an API on localhost:6767 with data under `~/.supermemory`, using Ollama for offline text memory. It says newer facts supersede older ones, time-bound facts expire, and connectors sync Google Drive, Gmail, Notion, OneDrive, GitHub and a crawler. npm: `supermemory` 5.1.2 (Apache-2.0), `@supermemory/tools` 3.1.3 (MIT).

## Key numbers
- The README reports 91 percent on Temporal Reasoning in a LongMemEval breakdown. Model, judge and split were not read, so this is unverified.

## What Engram borrows
- `profile()`, a standing summary plus query-time hits in one call, as the shape of a Twin read.
- `containerTag` maps to scope.

## What Engram does differently
Supersession and expiry happen inside the service with no recorded reason. Engram would adopt only the facts the store returns and decide supersession in the plane.

## Risk to our claims
The local mode's licence and what is open are unverified. Connector content brings third-party text into memory, a poisoning channel, so an adapter must write it with provenance `external`.

## Open question
Is the local API stable enough to run offline in CI without Ollama?

## Notes
Not read: the SDK source, the local-mode docs.
