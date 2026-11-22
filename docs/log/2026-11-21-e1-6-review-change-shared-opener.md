---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/cli/src/log.ts
  - packages/server/test/chain.test.ts
supersedes: docs/log/2026-11-21-e1-6-finding-unkept-writers.md
---

**What.** keepLogChain moved to packages/server and runs in openWorkspace().open(); packages/cli/src/chain.ts and the calls in connect.ts and serve.ts are removed.

**Why.** Review finding E1.6-1: the unkept writers this finding named were the pi package's, which the shared opener now covers.

**Result.** The runner and the bench still open their own handles with no chain, by design: their logs are never verified, and chaining them would add statements to every append that X15 counts. Mutation check: removing the call in open() fails the server test.

**Consequence.** The finding stands only for handles opened outside openWorkspace.
