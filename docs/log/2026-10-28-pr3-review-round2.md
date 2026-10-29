---
date: 2026-10-28
author: claude-agent
type: change
card: A4
chapter: implementation
pillar: plane
hypothesis: H4
evidence:
  - fixtures/stores/conformance-corpus.json
  - packages/adapters/test/conformance/broken.ts
  - packages/adapters/test/conformance/meta.test.ts
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/index.test.ts
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - "pnpm exec vitest run packages/adapters"
supersedes: none
---

**What.** Round 2 of the adapters review: a richer corpus with a search case for non-active items, seven new broken variants, each of nineteen pinned to its cases by name, and a files adapter that refuses hard links, writes all or nothing and breaks stale locks.

**Why.** The verifier found five missed bugs, a hard-link leak, half-done writes and a crashed writer's lock blocking writes.

**Result.** Every new test failed first: nine meta-test cases, eleven files tests. Mem0, files and both fakes pass the enriched suite. Of 26 mutants, 22 were killed at first; new tests now kill the Mem0 model-slot override (told apart from its placeholder) and the fetch and DNS guards. Two lock races and one equivalent title mutant survive.

**Consequence.** A crashed writer on this machine no longer blocks the folder; one on another machine blocks it for 60 s at most. Amendments: ADR 0013.
