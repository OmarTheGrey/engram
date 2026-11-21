---
id: repo-mastra-memory
title: Mastra memory (MastraMemory, Processor)
authors: Mastra (Kepler Software, Inc.)
venue: open-source library, 2025 to 2026
year: 2026
tier: new
topics: [framework, integration, store, processors]
engram: [govern, twin, plane]
code: https://github.com/mastra-ai/mastra
sources_read: [https://github.com/mastra-ai/mastra/blob/main/packages/core/src/memory/memory.ts, https://github.com/mastra-ai/mastra/blob/main/packages/core/src/processors/index.ts, https://github.com/mastra-ai/mastra/blob/main/LICENSE.md]
---

## Claim
Mastra, a very active TypeScript-native agent framework, has a heavy memory base class and a light processor pipeline; the processor is the cheap place to govern recall, the base class the place to govern storage.

## Method
`abstract class MastraMemory` (packages/core/src/memory/memory.ts) requires `getThreadById`, `listThreads`, `saveThread`, `saveMessages`, `recall`, `updateThread`, `deleteThread`, `getWorkingMemory`, `getWorkingMemoryTemplate`, `updateWorkingMemory`, `deleteMessages`, `cloneThread` and an experimental working-memory method. A separate `Processor` interface (packages/core/src/processors) has optional hooks `processInput`, `processInputStep`, `processOutputStream`, `processOutputResult`, `processOutputStep`, `processLLMRequest`, `processLLMResponse`, `processToolResult` and `processAPIError`, and tripwire violations that abort a run.

## Key numbers
- mastra-ai/mastra: 29,714 stars, pushed 2026-11-21. Licence: Apache-2.0 per npm and LICENSE.md (GitHub shows NOASSERTION) except any `ee/` directory, which has its own licence and is not absorbable. npm @mastra/core 1.85.0.

## What Engram borrows
A `Processor` named engram-governor: processInput recalls through Plane.read and injects tagged items; processOutputResult writes through Plane.write; a tripwire can abort when the gate denies a mandatory write. Lands in AB-FWK-4.

## What Engram does differently
Mastra memory is thread and resource keyed with working-memory templates; Engram is scope and grant keyed. Resource id maps to person scope, thread to the provenance ref.

## Risk to our claims
The memory API is large and moves fast (docs show the processor API rewritten between versions), so a full MastraMemory subclass is costly to keep current. Ship the processor first.

## Open question
Does a Processor-only integration count as governing Mastra memory when Memory still persists threads itself?

## Notes
The ee/ carve-out means a vendored copy must exclude it; a dependency does not.
