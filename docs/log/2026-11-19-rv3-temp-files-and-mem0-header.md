---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/src/mem0/index.ts
  - packages/adapters/test/files/rv3.test.ts
supersedes: none
---

**What.** The files adapter removes the temporary files a crashed writer left, and the Mem0 adapter's header no longer claims Mem0 links the entities of every memory (review finding RV-ADP-10).

**Why.** A writer that crashed between writing `.<key>.<pid>.<n>.engram-tmp` and renaming it left the file forever. The header said Mem0 links entities in each memory text; mem0ai 3.3.1's `addToVectorStore` with `infer: false` calls `createMemory`, which links none, and only `updateMemory` with changed text links them.

**Result.** The first write or delete of an instance, holding the folder lock, removes every file of that pattern, since a live writer holds the lock while its own exists; a read removes nothing, and other dot files stay. The test failed on the old code and fails again with the sweep removed (mutant R10).

**Consequence.** A search's entity boost sees only items rewritten with new content; the header says so.
