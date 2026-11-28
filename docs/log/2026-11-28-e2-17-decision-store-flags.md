---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/src/registry.ts
supersedes: none
---

**What.** `engram explain --absent` takes read's store flags (--store, --root, --import-valid-from), opening the store read-only, so the match stage uses the store's own search as the read with the same flags does; plain `engram explain` refuses them (review finding E2.17-5).

**Why.** Without a store the in-process plane matches by its own term share, which can differ from a store with its own search.

**Result.** The store is opened but neither swept nor adopted, as the no-sweep decision says.

**Consequence.** The TUI's workspace passes its store flags to the command, as to read.
