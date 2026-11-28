---
date: 2026-11-28
author: claude-agent
type: change
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/pi-extension/test/chain.test.ts
supersedes: none
---

**What.** `createEngramExtension` keeps the chain on the handle it is given when the log already has a genesis, with salts from node:crypto.

**Why.** A handle opened outside the shared opener appended unchained events to a chained log, which then verified FAILED at the anchor (docs/log/2026-11-21-e1-6-finding-unkept-writers.md).

**Result.** Before: chain.test.ts's first case failed (`keepsChain` false). After: an agent's memory_write and memory_read through the extension on a second handle to a CLI-chained SQLite log verify with no break and 0 unchained; a log with no chain keeps none (0 chain rows). The package's 16 test files pass (257 tests).

**Consequence.** The pi package's opener already kept the chain (openWorkspace); this covers every other caller.
