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
supersedes: none
---

**What.** Card A4 moved the conformance corpus and its search cases into the committed fixture `fixtures/stores/conformance-corpus.json` and made one registry the only place adapters are listed for the suite.

**Why.** The card asks for the suite parametrised over adapters on a fixture corpus, with the contract identical for every store.

**Result.** The suite parses every fixture item with the core `MemoryItem` schema, so the corpus cannot drift from it. `conformance.test.ts` runs the whole suite on every registry entry (fake, fake without search or history, Mem0) and lexical full recall on entries flagged lexical. Every existing case is kept with the same assertions. A fetch recorder refuses network calls; none happened.

**Consequence.** A new adapter is one registry entry; there is no per-adapter skip list.
