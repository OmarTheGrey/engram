---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/rv3.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
  - packages/adapters/test/files/index.test.ts
supersedes: none
---

**What.** The files adapter no longer indexes Engram items in the folder's `MEMORY.md`, and never reads or changes that file (review finding RV-ADP-3).

**Why.** Every plane write added the item's title to `MEMORY.md`, which Claude Code loads into every session by itself, outside the plane's read filter; a retirement, ttl expiry or eviction never removed the line (the reviewer's probe `index-leak.mts`: a retired door code stayed in the index).

**Result.** After a write, rewrite, retirement and delete, the fixture's `MEMORY.md` is byte for byte unchanged; after a ttl retirement through the plane, no line names the item or its content; a folder without `MEMORY.md` never gains one. Each failed on the old code. The index tests of `index.test.ts` went with the behaviour; the CLI's write test now asserts the item is not in the index.

**Consequence.** ADRs 0013 and 0028 and `docs/dogfood.md` are amended.
