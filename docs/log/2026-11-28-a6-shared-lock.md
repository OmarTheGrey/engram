---
date: 2026-11-28
author: claude-agent
type: decision
card: A6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mcp-memory/index.ts
  - packages/adapters/src/lock.ts
  - packages/adapters/test/mcp-memory/mcp-memory.test.ts
supersedes: none
---

**What.** The adapter's writes hold `<file>.lock`, the very lock file the server takes by exclusive create, through the shared store lock (`lock.ts`) with the server's own stale bound of 30 s.

**Why.** The card's risk is that the server rewrites the file: with one lock, neither rewrites it over the other's change. Both break a stale lock under the same `<lock>.break` guard.

**Result.** A fresh server-format lock makes a write wait and refuse naming it; one unrefreshed past 30 s is broken and the write goes through (tests in `mcp-memory.test.ts`). The server, finding no `hostname` in an Engram lock, judges it by age only.

**Consequence.** An Engram writer that crashed holding the lock blocks the server for 30 s at most. A `hostname` field in the shared lock record would let the server break it at once; not done, since it changes the files and Letta locks too.
