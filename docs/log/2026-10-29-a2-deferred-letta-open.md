---
date: 2026-10-29
author: claude-agent
type: decision
card: A2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/letta/deferred.ts
  - docs/decisions/0028-letta-adapter-over-memfs.md
supersedes: none
---

**What.** The workspace opens the Letta store through `deferLettaAdapter`: the folder is checked synchronously against the file-system rules, and the repository is opened by git in the background, every adapter call waiting for it (ADR 0028 amendments, Surfaces).

**Why.** `openWorkspace` and the CLI's `connect` are synchronous (PR 3), while opening a MemFS repository runs git; making both asynchronous would change every command and the MCP server for one store.

**Result.** A bad folder (a file, a symlink, a non-empty folder that is not a repository) is a usage error before anything runs (`packages/cli/test/letta.test.ts`). What only git can tell (a folder inside another repository, a bare repository, git missing) surfaces on the first store call; a write records it as a store failure event.

**Consequence.** If the workspace opener becomes asynchronous later, it can await `createLettaAdapter` and drop the deferral.
