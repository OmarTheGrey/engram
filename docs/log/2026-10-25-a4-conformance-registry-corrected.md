---
date: 2026-10-25
author: claude-agent
type: change
card: A4
chapter: implementation
pillar: plane
hypothesis: H4
evidence:
  - fixtures/stores/conformance-corpus.json
  - packages/adapters/test/conformance/registry.ts
  - packages/adapters/test/conformance/conformance.test.ts
  - packages/adapters/test/conformance/suite.ts
  - "pnpm exec vitest run packages/adapters/test/conformance"
supersedes: docs/log/2026-10-25-a4-conformance-corpus.md
---

**What.** Card A4 moved the conformance corpus and its search cases into the committed fixture `fixtures/stores/conformance-corpus.json` and made one registry the only place adapters are listed for the suite.

**Why.** The card asks for the suite parametrised over adapters on a fixture corpus, with the contract identical for every store. The earlier entry listed the registry before card A3 added the files adapter (review finding R4-13).

**Result.** The registry holds four entries: the fake, the fake without search or history, Mem0, and the files adapter. `conformance.test.ts` runs the whole suite on each and lexical full recall on the fake and the files adapter. Every fixture item is parsed by the core `MemoryItem` schema. A guard refuses fetch, sockets and DNS for the run; none was attempted.

**Consequence.** A new adapter is one registry entry; there is no per-adapter skip list.
