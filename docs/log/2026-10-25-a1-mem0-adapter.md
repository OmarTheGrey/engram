---
date: 2026-10-25
author: claude-agent
type: change
card: A1
chapter: implementation
pillar: plane
hypothesis: H4
evidence:
  - packages/adapters/src/mem0/index.ts
  - packages/adapters/src/fake/embedder.ts
  - packages/adapters/test/mem0/mem0.test.ts
  - "pnpm exec vitest run packages/adapters"
supersedes: none
---

**What.** Card A1 added the Mem0 adapter on open-source Mem0 (`mem0ai` 3.3.1, `mem0ai/oss`) with Mem0's own SQLite vector store, in memory or in a file.

**Why.** ADR 0013 holds every store to one contract; Mem0 is the first real store.

**Result.** Each MemoryItem is one Mem0 memory added with `infer: false`, so Mem0 stores the content verbatim and no model is called. The item rides in Mem0 metadata with `engram_id` and `engram_scope`, which `list` and `search` filter on. The embedder is injected; tests use a deterministic hashing embedder, and Mem0's model slot refuses every call. Telemetry is forced off and Mem0 writes nothing to its home directory. The Mem0 entry passes all 15 applicable conformance cases offline; the two history cases skip because the adapter offers no history.

**Consequence.** Search quality depends on the injected embedder, so Mem0 is not opted into lexical full recall.
