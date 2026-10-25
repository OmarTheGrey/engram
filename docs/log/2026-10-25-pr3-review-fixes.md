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
  - packages/adapters/test/conformance/suite.ts
  - packages/adapters/test/conformance/meta.test.ts
  - packages/adapters/test/conformance/broken.ts
  - packages/adapters/src/files/index.ts
  - packages/adapters/src/mem0/index.ts
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - "pnpm exec vitest run packages/adapters"
supersedes: none
---

**What.** Fixes for the sixteen review findings on the adapters pull request (cards A4, A1, A3): a richer corpus and whole-item comparisons in the conformance suite, a meta-test over twelve broken adapters, serial Mem0 writes, and a files adapter that skips malformed files and symlinks, refuses case collisions and locks the folder.

**Why.** The suite passed twelve broken adapters, and Mem0 and the files adapter lost or leaked data under concurrency, symlinks, case-insensitive folders and import order.

**Result.** Every behavioural finding has a test that failed first. The meta-test fails all twelve variants; of the 200 adapter tests, 187 pass and 13 skip for optional methods an adapter lacks, so the fakes, Mem0 and files pass the stronger suite. Contract clarifications, including orchestrator decision D1 on refs, are amendments in ADR 0013.

**Consequence.** A new adapter must keep every field intact; findings R4-8 and R4-13 have their own entries.
